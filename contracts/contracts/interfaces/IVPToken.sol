// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVPToken
 * @notice Interface for VP Token contract
 */
interface IVPToken {
    /**
     * @notice Stake vDOT to get VP
     * @param amount Amount of vDOT to stake
     * @return vpAmount Amount of VP minted
     */
    function stakeVdot(uint256 amount) external returns (uint256 vpAmount);

    /**
     * @notice Get VP balance for a user
     * @param user User address
     * @return balance VP balance
     */
    function balanceOf(address user) external view returns (uint256 balance);

    /**
     * @notice Burn VP tokens
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external;

    /**
     * @notice Mint VP tokens (for refund)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Calculate VP amount from vDOT amount
     * @param vdotAmount Amount of vDOT
     * @return vpAmount Amount of VP
     */
    function calculateVP(uint256 vdotAmount) external pure returns (uint256 vpAmount);
}
