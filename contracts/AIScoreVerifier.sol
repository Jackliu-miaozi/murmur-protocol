// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IAIScoreVerifier.sol";

/**
 * @title AIScoreVerifier
 * @notice Verifies AI service signatures for message intensity scores
 */
contract AIScoreVerifier is Ownable, IAIScoreVerifier {
    using ECDSA for bytes32;

    // AI verifier address
    address public verifier;

    // Domain separator for EIP-712
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant TYPE_HASH =
        keccak256("AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)");

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    constructor(address _verifier, address initialOwner) Ownable(initialOwner) {
        verifier = _verifier;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MurmurProtocol"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Verify AI signature for message score
     * @param contentHash Hash of message content
     * @param length Message length
     * @param aiScore AI intensity score (0-1, scaled to 1e18)
     * @param timestamp Timestamp
     * @param signature AI service signature
     * @return isValid True if signature is valid
     */
    function verifyScore(
        bytes32 contentHash,
        uint256 length,
        uint256 aiScore,
        uint256 timestamp,
        bytes memory signature
    ) external view returns (bool isValid) {
        require(verifier != address(0), "AIScoreVerifier: verifier not set");
        require(aiScore <= 1e18, "AIScoreVerifier: invalid score range");

        // Check timestamp is recent (within 5 minutes)
        require(block.timestamp >= timestamp && block.timestamp <= timestamp + 300, "AIScoreVerifier: invalid timestamp");

        // Build EIP-712 hash
        bytes32 structHash = keccak256(
            abi.encode(TYPE_HASH, contentHash, length, aiScore, timestamp)
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        // Recover signer
        address signer = hash.recover(signature);
        isValid = (signer == verifier);
    }

    /**
     * @notice Set AI verifier address
     * @param _verifier Verifier address
     */
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "AIScoreVerifier: invalid verifier");
        address oldVerifier = verifier;
        verifier = _verifier;
        emit VerifierUpdated(oldVerifier, _verifier);
    }
}
