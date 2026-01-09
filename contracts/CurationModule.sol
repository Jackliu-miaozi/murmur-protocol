// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICurationModule.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IMessageRegistry.sol";
import "./interfaces/ITopicVault.sol";

/**
 * @title CurationModule
 * @notice Manages curated messages selection and ranking
 */
contract CurationModule is Ownable, ICurationModule {
    ITopicFactory public topicFactory;
    IMessageRegistry public messageRegistry;
    ITopicVault public topicVault;

    // Curated messages per topic: topicId => messageIds[]
    mapping(uint256 => uint256[]) public curatedMessages;

    // Track if curated messages are finalized
    mapping(uint256 => bool) public finalized;

    // Track message like counts for sorting
    mapping(uint256 => uint256) public messageLikeCounts;

    event CuratedMessageAdded(uint256 indexed topicId, uint256 indexed messageId);
    event CuratedMessageRemoved(uint256 indexed topicId, uint256 indexed messageId);
    event CuratedMessagesFinalized(uint256 indexed topicId);

    constructor(
        address _topicFactory,
        address _messageRegistry,
        address _topicVault,
        address initialOwner
    ) Ownable(initialOwner) {
        topicFactory = ITopicFactory(_topicFactory);
        messageRegistry = IMessageRegistry(_messageRegistry);
        topicVault = ITopicVault(_topicVault);
    }

    /**
     * @notice Handle like event and update curated messages
     * @param topicId Topic ID
     * @param messageId Message ID
     */
    function onLike(uint256 topicId, uint256 messageId) external {
        // Only MessageRegistry can call this
        require(msg.sender == address(messageRegistry), "CurationModule: unauthorized");

        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);

        // Don't update if frozen or finalized
        if (topicFactory.isFrozen(topicId) || finalized[topicId]) {
            return;
        }

        // Get message
        IMessageRegistry.Message memory message = messageRegistry.getMessage(messageId);
        require(message.topicId == topicId, "CurationModule: topic mismatch");

        // Update like count
        messageLikeCounts[messageId] = message.likeCount;

        // Update curated messages
        _updateCuratedMessages(topicId);
    }

    /**
     * @notice Update curated messages based on like counts
     * @param topicId Topic ID
     */
    function _updateCuratedMessages(uint256 topicId) internal {
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        uint256 limit = topic.curatedLimit;

        // Get all messages for this topic
        uint256 messageCount = messageRegistry.getMessageCount(topicId);
        if (messageCount == 0) return;

        // Build array of (messageId, likeCount, timestamp) for sorting
        // Use a reasonable batch size to avoid gas issues
        uint256 batchSize = 100;
        uint256 batches = (messageCount + batchSize - 1) / batchSize;
        MessageScore[] memory allScores = new MessageScore[](messageCount);
        uint256 scoreIndex = 0;

        // Get all messages in batches
        for (uint256 batch = 0; batch < batches; batch++) {
            uint256 offset = batch * batchSize;
            uint256 limit = batchSize;
            if (offset + limit > messageCount) {
                limit = messageCount - offset;
            }

            IMessageRegistry.Message[] memory messages = messageRegistry.getMessagesByTopic(
                topicId,
                offset,
                limit
            );

            for (uint256 i = 0; i < messages.length; i++) {
                allScores[scoreIndex] = MessageScore({
                    messageId: messages[i].messageId,
                    likeCount: messages[i].likeCount,
                    timestamp: messages[i].timestamp
                });
                scoreIndex++;
            }
        }

        // Sort by like count (descending), then by timestamp (descending for tie-breaker)
        _sortMessages(allScores);

        // Update curated messages
        uint256[] memory newCurated = new uint256[](limit);
        uint256 curatedCount = 0;

        for (uint256 i = 0; i < allScores.length && curatedCount < limit; i++) {
            if (allScores[i].likeCount > 0) {
                newCurated[curatedCount] = allScores[i].messageId;
                curatedCount++;
            }
        }

        // Resize array
        uint256[] memory finalCurated = new uint256[](curatedCount);
        for (uint256 i = 0; i < curatedCount; i++) {
            finalCurated[i] = newCurated[i];
        }

        curatedMessages[topicId] = finalCurated;
    }

    /**
     * @notice Get curated message IDs for a topic
     * @param topicId Topic ID
     * @return messageIds Array of curated message IDs
     */
    function getCuratedMessages(uint256 topicId) external view returns (uint256[] memory messageIds) {
        return curatedMessages[topicId];
    }

    /**
     * @notice Get curated set hash for a topic
     * @param topicId Topic ID
     * @return hash Hash of curated message set
     */
    function curatedSetHash(uint256 topicId) external view returns (bytes32 hash) {
        uint256[] memory messageIds = curatedMessages[topicId];
        return keccak256(abi.encodePacked(messageIds));
    }

    /**
     * @notice Finalize curated messages (when topic ends, if less than limit, use VP consumption)
     * @param topicId Topic ID
     */
    function finalizeCuratedMessages(uint256 topicId) external {
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(
            topic.status == ITopicFactory.TopicStatus.Closed,
            "CurationModule: topic not closed"
        );
        require(!finalized[topicId], "CurationModule: already finalized");

        finalized[topicId] = true;

        // If curated messages are less than limit, fill with highest VP consumption
        uint256[] memory currentCurated = curatedMessages[topicId];
        if (currentCurated.length < topic.curatedLimit) {
            _fillWithVpConsumption(topicId, currentCurated.length, topic.curatedLimit);
        }

        emit CuratedMessagesFinalized(topicId);
    }

    /**
     * @notice Fill curated messages with highest VP consumption messages
     * @param topicId Topic ID
     * @param startIndex Start index
     * @param limit Limit
     */
    function _fillWithVpConsumption(
        uint256 topicId,
        uint256 startIndex,
        uint256 limit
    ) internal {
        uint256 messageCount = messageRegistry.getMessageCount(topicId);
        if (messageCount == 0) return;

        // Get all messages and sort by VP cost
        MessageVpScore[] memory vpScores = new MessageVpScore[](messageCount);
        uint256 index = 0;

        for (uint256 i = 0; i < messageCount; i++) {
            IMessageRegistry.Message[] memory messages = messageRegistry.getMessagesByTopic(
                topicId,
                i,
                1
            );
            if (messages.length > 0) {
                // Check if already curated
                bool alreadyCurated = false;
                for (uint256 j = 0; j < curatedMessages[topicId].length; j++) {
                    if (curatedMessages[topicId][j] == messages[0].messageId) {
                        alreadyCurated = true;
                        break;
                    }
                }

                if (!alreadyCurated) {
                    vpScores[index] = MessageVpScore({
                        messageId: messages[0].messageId,
                        vpCost: messages[0].vpCost
                    });
                    index++;
                }
            }
        }

        // Sort by VP cost (descending)
        _sortByVp(vpScores, index);

        // Add to curated messages
        uint256[] memory currentCurated = curatedMessages[topicId];
        uint256 needed = limit - startIndex;
        uint256 addCount = needed < index ? needed : index;

        uint256[] memory newCurated = new uint256[](currentCurated.length + addCount);
        for (uint256 i = 0; i < currentCurated.length; i++) {
            newCurated[i] = currentCurated[i];
        }
        for (uint256 i = 0; i < addCount; i++) {
            newCurated[currentCurated.length + i] = vpScores[i].messageId;
        }

        curatedMessages[topicId] = newCurated;
    }

    /**
     * @notice Sort messages by like count and timestamp
     */
    function _sortMessages(MessageScore[] memory scores) internal pure {
        // Simple bubble sort (for small arrays)
        for (uint256 i = 0; i < scores.length; i++) {
            for (uint256 j = 0; j < scores.length - i - 1; j++) {
                if (
                    scores[j].likeCount < scores[j + 1].likeCount ||
                    (scores[j].likeCount == scores[j + 1].likeCount &&
                        scores[j].timestamp < scores[j + 1].timestamp)
                ) {
                    MessageScore memory temp = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = temp;
                }
            }
        }
    }

    /**
     * @notice Sort messages by VP cost
     */
    function _sortByVp(MessageVpScore[] memory scores, uint256 length) internal pure {
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (scores[j].vpCost < scores[j + 1].vpCost) {
                    MessageVpScore memory temp = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = temp;
                }
            }
        }
    }

    struct MessageScore {
        uint256 messageId;
        uint256 likeCount;
        uint256 timestamp;
    }

    struct MessageVpScore {
        uint256 messageId;
        uint256 vpCost;
    }
}
