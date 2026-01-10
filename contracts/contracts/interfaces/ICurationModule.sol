// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICurationModule
 * @notice Interface for Curation Module contract
 */
interface ICurationModule {
    /**
     * @notice Handle new message posted event
     * @param topicId Topic ID
     * @param messageId Message ID
     */
    function onMessagePosted(uint256 topicId, uint256 messageId) external view;

    /**
     * @notice Handle like event and update curated messages
     * @param topicId Topic ID
     * @param messageId Message ID
     */
    function onLike(uint256 topicId, uint256 messageId) external;

    /**
     * @notice Get curated message IDs for a topic
     * @param topicId Topic ID
     * @return messageIds Array of curated message IDs
     */
    function getCuratedMessages(uint256 topicId) external view returns (uint256[] memory messageIds);

    /**
     * @notice Get curated set hash for a topic
     * @param topicId Topic ID
     * @return hash Hash of curated message set
     */
    function curatedSetHash(uint256 topicId) external view returns (bytes32 hash);

    /**
     * @notice Check if curated messages are finalized
     * @param topicId Topic ID
     * @return finalized True if finalized
     */
    function finalized(uint256 topicId) external view returns (bool);

    /**
     * @notice Finalize curated messages (when topic ends, if less than limit, use VP consumption)
     * @param topicId Topic ID
     */
    function finalizeCuratedMessages(uint256 topicId) external;
}
