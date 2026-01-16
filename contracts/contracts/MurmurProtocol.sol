// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MurmurProtocol
 * @notice Protocol registry for V2 minimal architecture
 * @dev Only 3 core contracts: VDOTToken, VPToken, MurmurNFT
 */
contract MurmurProtocol {
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

  constructor(address _vdotToken, address _vpToken, address _murmurNFT) {
    vdotToken = _vdotToken;
    vpToken = _vpToken;
    murmurNFT = _murmurNFT;

    emit ProtocolDeployed(_vdotToken, _vpToken, _murmurNFT);
  }
}
