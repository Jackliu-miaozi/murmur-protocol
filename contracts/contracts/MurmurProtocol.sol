// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title MurmurProtocol
 * @notice Protocol registry for V2 minimal architecture
 * @dev Only 3 core contracts: VDOTToken, VPToken, MurmurNFT
 */
contract MurmurProtocol is Initializable, UUPSUpgradeable, OwnableUpgradeable {
  // V2 Minimal Architecture - only 3 contracts
  // All other logic (topics, messages, curation) is handled off-chain

  event ProtocolDeployed(
    address indexed vdotToken,
    address indexed vpToken,
    address indexed murmurNFT
  );

  address public vdotToken;
  address public vpToken;
  address public murmurNFT;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _vdotToken,
    address _vpToken,
    address _murmurNFT
  ) public initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();

    vdotToken = _vdotToken;
    vpToken = _vpToken;
    murmurNFT = _murmurNFT;

    emit ProtocolDeployed(_vdotToken, _vpToken, _murmurNFT);
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}
}
