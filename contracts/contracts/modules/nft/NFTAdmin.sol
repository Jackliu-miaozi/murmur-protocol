// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";

/**
 * @title NFTAdminFacet
 * @dev NFT admin functionality (Diamond Facet)
 */
contract NFTAdmin {
  event OperatorUpdated(address indexed operator, bool status);
  event FeeRecipientUpdated(
    address indexed oldRecipient,
    address indexed newRecipient
  );

  modifier onlyOwner() {
    require(msg.sender == LibNFTStorage.load().owner, "NFT: not owner");
    _;
  }

  function setOperator(address operator, bool status) external onlyOwner {
    LibNFTStorage.load().operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  function setFeeRecipient(address newRecipient) external onlyOwner {
    require(newRecipient != address(0), "NFT: zero address");
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    address oldRecipient = s.feeRecipient;
    s.feeRecipient = newRecipient;
    emit FeeRecipientUpdated(oldRecipient, newRecipient);
  }

  function feeRecipient() external view returns (address) {
    return LibNFTStorage.load().feeRecipient;
  }

  function isOperator(address operator) external view returns (bool) {
    return LibNFTStorage.load().operators[operator];
  }

  function nftOwner() external view returns (address) {
    return LibNFTStorage.load().owner;
  }

  function totalSupply() external view returns (uint256) {
    return LibNFTStorage.load().tokenIdCounter;
  }
}
