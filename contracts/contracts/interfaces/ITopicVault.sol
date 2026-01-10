// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITopicVault
 * @notice Interface for Topic Vault contract
 * @dev Users now use global VP directly. This contract only tracks VP consumption for refunds.
 */
interface ITopicVault {
    /**
     * @notice Lock vDOT to get topic-scoped VP (DEPRECATED)
     * @dev This function is deprecated. Users now use global VP directly from VPToken contract.
     * @param topicId Topic ID
     * @param amount Amount of vDOT (used for VP calculation, not actually locked)
     * @return vpAmount Amount of topic-scoped VP minted
     */
    function lockVdot(uint256 topicId, uint256 amount) external returns (uint256 vpAmount);

    /**
     * @notice Get topic-scoped VP balance (DEPRECATED)
     * @dev Users now use global VP directly. This function always returns 0.
     * @param topicId Topic ID
     * @param user User address
     * @return balance Always returns 0
     */
    function balanceOf(uint256 topicId, address user) external view returns (uint256 balance);

    /**
     * @notice Record VP consumption for a topic
     * @dev This function tracks VP consumption for refund purposes. VP is burned directly from VPToken.
     * @param topicId Topic ID
     * @param from Address that consumed VP
     * @param amount Amount of VP consumed
     */
    function recordVpConsumption(uint256 topicId, address from, uint256 amount) external;

    /**
     * @notice Burn topic-scoped VP (DEPRECATED - use recordVpConsumption instead)
     * @dev This function is deprecated. Use recordVpConsumption() instead.
     * @param topicId Topic ID
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(uint256 topicId, address from, uint256 amount) external;

    /**
     * @notice Check if user can redeem vDOT
     * @param user User address
     * @return canRedeem True if can redeem
     */
    function canRedeem(address user) external view returns (bool canRedeem);

    /**
     * @notice Redeem vDOT (requires all topics user participated in are closed)
     */
    function redeemVdot() external;

    /**
     * @notice Refund VP to all participants for a topic
     * @param topicId Topic ID
     */
    function refundVPForTopic(uint256 topicId) external;
}
