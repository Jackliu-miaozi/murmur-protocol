// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";
import { LibPausable } from "../../libraries/LibPausable.sol";

/**
 * @title NFTAdminFacet
 * @notice NFT admin functionality (Diamond Facet)
 * @dev Provides operator management, ownership transfer, pause control, and fee configuration
 */
contract NFTAdmin {
  event OperatorUpdated(address indexed operator, bool status);
  event FeeRecipientUpdated(
    address indexed oldRecipient,
    address indexed newRecipient
  );
  event OwnershipTransferStarted(
    address indexed currentOwner,
    address indexed pendingOwner
  );
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );

  modifier onlyOwner() {
    require(msg.sender == LibNFTStorage.load().owner, "NFT: not owner");
    _;
  }

  // ============ Operator Management ============

  /**
   * @notice Set or revoke operator status for an address
   * @param operator Address to update
   * @param status True to grant, false to revoke
   */
  function setOperator(address operator, bool status) external onlyOwner {
    LibNFTStorage.load().operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  /**
   * @notice Check if an address is an operator
   */
  function isOperator(address operator) external view returns (bool) {
    return LibNFTStorage.load().operators[operator];
  }

  // ============ Fee Configuration ============

  /**
   * @notice Update the fee recipient address
   * @param newRecipient New address to receive minting fees
   */
  function setFeeRecipient(address newRecipient) external onlyOwner {
    require(newRecipient != address(0), "NFT: zero address");
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    address oldRecipient = s.feeRecipient;
    s.feeRecipient = newRecipient;
    emit FeeRecipientUpdated(oldRecipient, newRecipient);
  }

  /**
   * @notice Get current fee recipient
   */
  function feeRecipient() external view returns (address) {
    return LibNFTStorage.load().feeRecipient;
  }

  // ============ Ownership (Two-Step Transfer) ============

  /**
   * @notice Get current owner
   */
  function nftOwner() external view returns (address) {
    return LibNFTStorage.load().owner;
  }

  /**
   * @notice Get pending owner (awaiting acceptance)
   */
  function pendingOwner() external view returns (address) {
    return LibNFTStorage.load().pendingOwner;
  }

  /**
   * @notice Start ownership transfer (step 1)
   * @param newOwner Address of the new owner
   */
  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "NFT: invalid new owner");
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    s.pendingOwner = newOwner;
    emit OwnershipTransferStarted(s.owner, newOwner);
  }

  /**
   * @notice Accept ownership transfer (step 2)
   * @dev Only the pending owner can call this
   */
  function acceptOwnership() external {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(msg.sender == s.pendingOwner, "NFT: not pending owner");

    address oldOwner = s.owner;
    s.owner = msg.sender;
    s.pendingOwner = address(0);

    emit OwnershipTransferred(oldOwner, msg.sender);
  }

  /**
   * @notice Cancel pending ownership transfer
   */
  function cancelOwnershipTransfer() external onlyOwner {
    LibNFTStorage.load().pendingOwner = address(0);
  }

  // ============ Pause Control ============

  /**
   * @notice Pause all pausable operations
   */
  function pause() external onlyOwner {
    LibPausable.pause();
  }

  /**
   * @notice Unpause all operations
   */
  function unpause() external onlyOwner {
    LibPausable.unpause();
  }

  /**
   * @notice Check if protocol is paused
   */
  function paused() external view returns (bool) {
    return LibPausable.isPaused();
  }

  // ============ Query Functions ============

  /**
   * @notice Get total number of minted NFTs
   */
  function totalSupply() external view returns (uint256) {
    return LibNFTStorage.load().tokenIdCounter;
  }
}
