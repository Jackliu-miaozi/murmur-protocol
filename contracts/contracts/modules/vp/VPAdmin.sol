// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import { LibPausable } from "../../libraries/LibPausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VPAdminFacet
 * @notice VP Token admin functionality (Diamond Facet)
 * @dev Provides operator management, ownership transfer, pause control, and emergency functions
 */
contract VPAdmin {
  using SafeERC20 for IERC20;

  event OperatorUpdated(address indexed operator, bool status);
  event OwnershipTransferStarted(
    address indexed currentOwner,
    address indexed pendingOwner
  );
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );
  event EmergencyDelayUpdated(uint256 oldDelay, uint256 newDelay);

  modifier onlyOwner() {
    require(msg.sender == LibVPStorage.load().owner, "VP: not owner");
    _;
  }

  // ============ Operator Management ============

  /**
   * @notice Set or revoke operator status for an address
   * @param operator Address to update
   * @param status True to grant, false to revoke
   */
  function setOperator(address operator, bool status) external onlyOwner {
    require(operator != address(0), "VP: zero address");
    LibVPStorage.load().operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  /**
   * @notice Check if an address is an operator
   */
  function isOperator(address operator) external view returns (bool) {
    return LibVPStorage.load().operators[operator];
  }

  // ============ Ownership (Two-Step Transfer) ============

  /**
   * @notice Get current owner
   */
  function vpOwner() external view returns (address) {
    return LibVPStorage.load().owner;
  }

  /**
   * @notice Get pending owner (awaiting acceptance)
   */
  function pendingOwner() external view returns (address) {
    return LibVPStorage.load().pendingOwner;
  }

  /**
   * @notice Start ownership transfer (step 1)
   * @param newOwner Address of the new owner
   */
  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "VP: invalid new owner");
    LibVPStorage.Storage storage s = LibVPStorage.load();
    s.pendingOwner = newOwner;
    emit OwnershipTransferStarted(s.owner, newOwner);
  }

  /**
   * @notice Accept ownership transfer (step 2)
   * @dev Only the pending owner can call this
   */
  function acceptOwnership() external {
    LibVPStorage.Storage storage s = LibVPStorage.load();
    require(msg.sender == s.pendingOwner, "VP: not pending owner");

    address oldOwner = s.owner;
    s.owner = msg.sender;
    s.pendingOwner = address(0);

    emit OwnershipTransferred(oldOwner, msg.sender);
  }

  /**
   * @notice Cancel pending ownership transfer
   */
  function cancelOwnershipTransfer() external onlyOwner {
    LibVPStorage.load().pendingOwner = address(0);
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

  // ============ Emergency Functions ============

  /**
   * @notice Emergency withdraw tokens (owner only)
   * @param to Recipient address
   * @param amount Amount to withdraw
   */
  function emergencyWithdrawTokens(
    address to,
    uint256 amount
  ) external onlyOwner {
    require(to != address(0), "VP: invalid recipient");
    LibVPStorage.load().vdotToken.safeTransfer(to, amount);
  }

  /**
   * @notice Update emergency withdrawal delay
   * @param newDelay New delay in seconds
   */
  function setEmergencyDelay(uint256 newDelay) external onlyOwner {
    require(newDelay >= 1 days, "VP: delay too short");
    require(newDelay <= 30 days, "VP: delay too long");
    LibVPStorage.Storage storage s = LibVPStorage.load();
    uint256 oldDelay = s.emergencyDelay;
    s.emergencyDelay = newDelay;
    emit EmergencyDelayUpdated(oldDelay, newDelay);
  }

  /**
   * @notice Get vDOT token address
   */
  function vdotToken() external view returns (address) {
    return address(LibVPStorage.load().vdotToken);
  }
}
