// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITopicFactory.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/IAIScoreVerifier.sol";
import "./CurationModule.sol";
import "./MessageRegistry.sol";

/**
 * @title DeploymentHelper
 * @notice Helper contract to deploy CurationModule and MessageRegistry with circular dependency
 * @dev Uses CREATE2 to pre-compute addresses and deploy both contracts atomically
 */
contract DeploymentHelper {
    ITopicFactory public topicFactory;
    address public owner;

    event CurationModuleDeployed(address indexed curationModule);
    event MessageRegistryDeployed(address indexed messageRegistry);

    constructor(address _topicFactory, address _owner) {
        require(_topicFactory != address(0), "DeploymentHelper: invalid topic factory");
        require(_owner != address(0), "DeploymentHelper: invalid owner");
        topicFactory = ITopicFactory(_topicFactory);
        owner = _owner;
    }

    /**
     * @notice Compute CurationModule address using CREATE2
     * @param messageRegistry MessageRegistry address
     * @param salt Salt for CREATE2
     * @return address Computed address
     */
    function computeCurationModuleAddress(
        address messageRegistry,
        bytes32 salt
    ) public view returns (address) {
        // Encode constructor parameters
        bytes memory constructorArgs = abi.encode(address(topicFactory), messageRegistry, owner);
        // Get creation code
        bytes memory bytecode = abi.encodePacked(
            type(CurationModule).creationCode,
            constructorArgs
        );
        bytes32 bytecodeHash = keccak256(bytecode);
        
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                bytecodeHash
                            )
                        )
                    )
                )
            );
    }

    /**
     * @notice Compute MessageRegistry address using CREATE2
     * @param topicVault TopicVault address
     * @param aiVerifier AIScoreVerifier address
     * @param curationModule CurationModule address
     * @param salt Salt for CREATE2
     * @return address Computed address
     */
    function computeMessageRegistryAddress(
        address topicVault,
        address aiVerifier,
        address curationModule,
        bytes32 salt
    ) public view returns (address) {
        // Encode constructor parameters
        bytes memory constructorArgs = abi.encode(
            address(topicFactory),
            topicVault,
            aiVerifier,
            curationModule,
            owner
        );
        // Get creation code
        bytes memory bytecode = abi.encodePacked(
            type(MessageRegistry).creationCode,
            constructorArgs
        );
        bytes32 bytecodeHash = keccak256(bytecode);
        
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                bytecodeHash
                            )
                        )
                    )
                )
            );
    }

    /**
     * @notice Deploy CurationModule and MessageRegistry atomically
     * @param topicVault TopicVault address
     * @param aiVerifier AIScoreVerifier address
     * @param curationSalt Salt for CurationModule CREATE2
     * @param messageSalt Salt for MessageRegistry CREATE2
     * @return curationModule Deployed CurationModule address
     * @return messageRegistry Deployed MessageRegistry address
     */
    function deployBoth(
        address topicVault,
        address aiVerifier,
        bytes32 curationSalt,
        bytes32 messageSalt
    ) public returns (address curationModule, address messageRegistry) {
        // Step 1: Compute both addresses
        // First compute MessageRegistry address with a placeholder CurationModule
        // But we need the real CurationModule address, so we'll use an iterative approach

        // Actually, we can compute them in order:
        // 1. Compute CurationModule address (needs MessageRegistry address, which we'll compute next)
        // 2. Compute MessageRegistry address using the computed CurationModule address
        // 3. Recompute CurationModule address using the computed MessageRegistry address
        // 4. Deploy MessageRegistry first (it will be deployed at the computed address)
        // 5. Deploy CurationModule (it will be deployed at the recomputed address)

        // Iteratively compute addresses until they converge
        // Start with a placeholder that's different from address(0) and address(1)
        address computedMessageRegistry = address(uint160(uint256(keccak256(abi.encodePacked("MessageRegistry", address(this), messageSalt)))));
        address computedCurationModule;
        
        // Iterate until addresses converge
        // Use a large number of iterations
        uint256 maxIterations = 100;
        
        for (uint256 i = 0; i < maxIterations; i++) {
            // Compute CurationModule with current MessageRegistry
            computedCurationModule = computeCurationModuleAddress(
                computedMessageRegistry,
                curationSalt
            );
            
            // Compute MessageRegistry with computed CurationModule
            address newMessageRegistry = computeMessageRegistryAddress(
                topicVault,
                aiVerifier,
                computedCurationModule,
                messageSalt
            );
            
            // Check if converged
            if (newMessageRegistry == computedMessageRegistry) {
                break;
            }
            
            computedMessageRegistry = newMessageRegistry;
        }
        
        // Final check: recompute to ensure consistency
        computedCurationModule = computeCurationModuleAddress(
            computedMessageRegistry,
            curationSalt
        );
        address finalMessageRegistry = computeMessageRegistryAddress(
            topicVault,
            aiVerifier,
            computedCurationModule,
            messageSalt
        );
        
        // For CREATE2 to work, we need exact match
        // If not converged, we cannot proceed
        require(
            finalMessageRegistry == computedMessageRegistry,
            "DeploymentHelper: addresses did not converge"
        );

        // Deploy MessageRegistry first (at computed address)
        bytes memory messageRegistryConstructorArgs = abi.encode(
            address(topicFactory),
            topicVault,
            aiVerifier,
            computedCurationModule,
            owner
        );
        bytes memory messageRegistryBytecode = abi.encodePacked(
            type(MessageRegistry).creationCode,
            messageRegistryConstructorArgs
        );

        assembly {
            messageRegistry := create2(
                0,
                add(messageRegistryBytecode, 0x20),
                mload(messageRegistryBytecode),
                messageSalt
            )
            if iszero(messageRegistry) {
                revert(0, 0)
            }
        }

        emit MessageRegistryDeployed(messageRegistry);
        require(
            messageRegistry == computedMessageRegistry,
            "DeploymentHelper: MessageRegistry address mismatch"
        );

        // Deploy CurationModule (at computed address)
        bytes memory curationModuleConstructorArgs = abi.encode(
            address(topicFactory),
            messageRegistry,
            owner
        );
        bytes memory curationModuleBytecode = abi.encodePacked(
            type(CurationModule).creationCode,
            curationModuleConstructorArgs
        );

        assembly {
            curationModule := create2(
                0,
                add(curationModuleBytecode, 0x20),
                mload(curationModuleBytecode),
                curationSalt
            )
            if iszero(curationModule) {
                revert(0, 0)
            }
        }

        emit CurationModuleDeployed(curationModule);
        require(
            curationModule == computedCurationModule,
            "DeploymentHelper: CurationModule address mismatch"
        );
    }
}
