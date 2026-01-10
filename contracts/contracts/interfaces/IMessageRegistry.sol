// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMessageRegistry
 * @notice Interface for Message Registry contract
 */
interface IMessageRegistry {
    struct Message {
        uint256 messageId;
        uint256 topicId;
        address author;
        bytes32 contentHash;
        uint256 length;
        uint256 aiScore;
        uint256 timestamp;
        uint256 likeCount;
        uint256 vpCost;
    }

    /**
     * @notice Get message information
     * @param messageId Message ID
     * @return message Message struct
     */
    function getMessage(uint256 messageId) external view returns (Message memory message);

    /**
     * @notice Get message count for a topic
     * @param topicId Topic ID
     * @return count Message count
     */
    function getMessageCount(uint256 topicId) external view returns (uint256 count);

    /**
     * @notice Get messages by topic
     * @param topicId Topic ID
     * @param offset Offset
     * @param limit Limit
     * @return messages Array of messages
     */
    function getMessagesByTopic(
        uint256 topicId,
        uint256 offset,
        uint256 limit
    ) external view returns (Message[] memory messages);

    /**
     * @notice Check if user has posted in topic
     * @param topicId Topic ID
     * @param user User address
     * @return hasPosted True if user has posted
     */
    function hasUserPostedInTopic(uint256 topicId, address user) external view returns (bool hasPosted);
}
