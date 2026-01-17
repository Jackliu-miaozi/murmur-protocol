// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VPAdminFacet
 * @dev VP Token admin functionality (Diamond Facet)
 */
contract VPAdmin {
  using SafeERC20 for IERC20;

  event OperatorUpdated(address indexed operator, bool status);

  modifier onlyOwner() {
    require(msg.sender == LibVPStorage.load().owner, "VP: not owner");
    _;
  }

  function setOperator(address operator, bool status) external onlyOwner {
    LibVPStorage.load().operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  function isOperator(address operator) external view returns (bool) {
    return LibVPStorage.load().operators[operator];
  }

  function vpOwner() external view returns (address) {
    return LibVPStorage.load().owner;
  }

  function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
    require(to != address(0), "VP: invalid recipient");
    LibVPStorage.load().vdotToken.safeTransfer(to, amount);
  }

  function vdotToken() external view returns (address) {
    return address(LibVPStorage.load().vdotToken);
  }
}
