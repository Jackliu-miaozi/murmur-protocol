// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITopicFactory
 * @notice Interface for Topic Factory contract
 */
interface ITopicFactory {
    enum TopicStatus {
        Draft,
        Live,
        Closed,
        Minted,
        Settled
    }

    struct Topic {
        uint256 topicId;
        address creator;
        bytes32 metadataHash;
        uint256 createdAt;
        uint256 duration;
        uint256 freezeWindow;
        uint256 curatedLimit;
        TopicStatus status;
        bool minted;
    }

    /**
     * @notice Get topic information
     * @param topicId Topic ID
     * @return topic Topic struct
     */
    function getTopic(uint256 topicId) external view returns (Topic memory topic);

    /**
     * @notice Check if topic is frozen (in freeze window)
     * @param topicId Topic ID
     * @return isFrozen True if frozen
     */
    function isFrozen(uint256 topicId) external view returns (bool isFrozen);

    /**
     * @notice Check if topic is expired
     * @param topicId Topic ID
     * @return isExpired True if expired
     */
    function isExpired(uint256 topicId) external view returns (bool isExpired);

    /**
     * @notice Mark topic as minted
     * @param topicId Topic ID
     */
    function markMinted(uint256 topicId) external;

    /**
     * @notice Close topic manually
     * @param topicId Topic ID
     */
    function closeTopic(uint256 topicId) external;

    /**
     * @notice Check and close topic if expired
     * @param topicId Topic ID
     * @return closed True if topic was closed
     */
    function checkAndCloseTopic(uint256 topicId) external returns (bool closed);

    /**
     * @notice Check if user can redeem
     * @param user User address
     * @return canRedeem True if can redeem
     */
    function canUserRedeem(address user) external view returns (bool canRedeem);
}
