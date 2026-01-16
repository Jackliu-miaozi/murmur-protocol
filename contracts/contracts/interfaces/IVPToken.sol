// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVPToken
 * @notice Interface for VP Token contract (Minimal Architecture V2)
 * @dev Supports batch operations with backend signatures
 */
interface IVPToken {
  /**
   * @notice Stake vDOT to get VP
   * @param amount Amount of vDOT to stake
   * @return vpAmount Amount of VP minted
   */
  function stakeVdot(uint256 amount) external returns (uint256 vpAmount);

  /**
   * @notice Withdraw vDOT by burning VP
   * @param vpBurnAmount Amount of VP to burn
   * @param vdotReturn Amount of vDOT to return
   * @param nonce Nonce for replay protection
   * @param signature Backend signature
   */
  function withdrawWithVP(
    uint256 vpBurnAmount,
    uint256 vdotReturn,
    uint256 nonce,
    bytes calldata signature
  ) external;

  /**
   * @notice Get VP balance for a user
   * @param user User address
   * @return balance VP balance
   */
  function balanceOf(address user) external view returns (uint256 balance);

  /**
   * @notice Batch burn VP tokens (requires backend signature)
   * @param users Array of user addresses
   * @param amounts Array of amounts to burn
   * @param nonce Unique nonce to prevent replay
   * @param signature Backend EIP-712 signature
   */
  function batchBurn(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
  ) external;

  /**
   * @notice Batch mint VP tokens (requires backend signature)
   * @param users Array of user addresses
   * @param amounts Array of amounts to mint
   * @param nonce Unique nonce to prevent replay
   * @param signature Backend EIP-712 signature
   */
  function batchMint(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
  ) external;

  /**
   * @notice Calculate VP amount from vDOT amount
   * @param vdotAmount Amount of vDOT
   * @return vpAmount Amount of VP
   */
  function calculateVP(
    uint256 vdotAmount
  ) external pure returns (uint256 vpAmount);

  /**
   * @notice Get current nonce for batch operations
   * @return Current nonce
   */
  function batchNonce() external view returns (uint256);
}
