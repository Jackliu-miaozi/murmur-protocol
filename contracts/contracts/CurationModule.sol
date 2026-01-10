// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ICurationModule.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IMessageRegistry.sol";

/**
 * @title CurationModule
 * @notice Manages curated messages selection and ranking
 */
contract CurationModule is AccessControl, ICurationModule {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ITopicFactory public topicFactory;
    IMessageRegistry public messageRegistry;

    // Curated messages per topic: topicId => messageIds[]
    mapping(uint256 => uint256[]) public curatedMessages;

    // Track if curated messages are finalized
    mapping(uint256 => bool) public finalized;

    // Track message positions in curated list for efficient updates
    mapping(uint256 => mapping(uint256 => bool)) public isInCurated; // topicId => messageId => bool

    // Maximum messages to process in one transaction
    uint256 public constant MAX_BATCH_SIZE = 50;

    event CuratedMessageAdded(uint256 indexed topicId, uint256 indexed messageId);
    event CuratedMessageRemoved(uint256 indexed topicId, uint256 indexed messageId);
    event CuratedMessagesFinalized(uint256 indexed topicId);
    event MessageRegistryUpdated(address indexed oldAddress, address indexed newAddress);

    constructor(
        address _topicFactory,
        address _messageRegistry,
        address initialOwner
    ) {
        require(_topicFactory != address(0), "CurationModule: invalid topic factory");
        require(_messageRegistry != address(0), "CurationModule: invalid message registry");
        require(initialOwner != address(0), "CurationModule: invalid owner");
        
        topicFactory = ITopicFactory(_topicFactory);
        messageRegistry = IMessageRegistry(_messageRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
    }

    /**
     * @notice Handle new message posted event
     * @dev Parameters are required by interface but not used in current implementation
     */
    function onMessagePosted(uint256 /* topicId */, uint256 /* messageId */) external view {
        require(msg.sender == address(messageRegistry), "CurationModule: unauthorized");
        // New messages with 0 likes don't enter curated list yet
        // They will be added when they receive likes
    }

    /**
     * @notice Handle like event and update curated messages
     * @param topicId Topic ID
     * @param messageId Message ID
     */
    function onLike(uint256 topicId, uint256 messageId) external {
        require(msg.sender == address(messageRegistry), "CurationModule: unauthorized");

        // Don't update if frozen or finalized
        if (topicFactory.isFrozen(topicId) || finalized[topicId]) {
            return;
        }

        // Get topic info for curated limit
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        uint256 curatedLimit = topic.curatedLimit;

        // Get message info
        IMessageRegistry.Message memory message = messageRegistry.getMessage(messageId);
        require(message.topicId == topicId, "CurationModule: topic mismatch");

        // Update curated list efficiently
        _updateCuratedList(topicId, messageId, message.likeCount, message.timestamp, curatedLimit);
    }

    /**
     * @notice Efficiently update curated list when a message receives a like
     * @param topicId Topic ID
     * @param messageId Message ID
     * @param likeCount Current like count
     * @param timestamp Message timestamp
     * @param curatedLimit Maximum curated messages
     */
    function _updateCuratedList(
        uint256 topicId,
        uint256 messageId,
        uint256 likeCount,
        uint256 timestamp,
        uint256 curatedLimit
    ) internal {
        uint256[] storage curated = curatedMessages[topicId];

        // If message is already in curated, it just got more likes - no reorder needed for simple case
        if (isInCurated[topicId][messageId]) {
            // Message already in curated list, position may change but we'll reorder later
            return;
        }

        // Message not in curated list yet
        if (likeCount == 0) {
            // No likes, don't add
            return;
        }

        if (curated.length < curatedLimit) {
            // List not full, add directly
            curated.push(messageId);
            isInCurated[topicId][messageId] = true;
            emit CuratedMessageAdded(topicId, messageId);
        } else {
            // List full, check if this message should replace the lowest
            (uint256 minLikes, uint256 minTimestamp, uint256 minIndex) = _findMinInCurated(topicId);
            
            // Replace if: more likes, or same likes but newer
            if (likeCount > minLikes || (likeCount == minLikes && timestamp > minTimestamp)) {
                uint256 removedId = curated[minIndex];
                isInCurated[topicId][removedId] = false;
                emit CuratedMessageRemoved(topicId, removedId);
                
                curated[minIndex] = messageId;
                isInCurated[topicId][messageId] = true;
                emit CuratedMessageAdded(topicId, messageId);
            }
        }
    }

    /**
     * @notice Find message with minimum likes in curated list
     * @param topicId Topic ID
     * @return minLikes Minimum like count
     * @return minTimestamp Timestamp of min message
     * @return minIndex Index of min message
     */
    function _findMinInCurated(uint256 topicId) internal view returns (
        uint256 minLikes,
        uint256 minTimestamp,
        uint256 minIndex
    ) {
        uint256[] storage curated = curatedMessages[topicId];
        require(curated.length > 0, "CurationModule: empty curated list");

        minLikes = type(uint256).max;
        minTimestamp = type(uint256).max;
        minIndex = 0;

        for (uint256 i = 0; i < curated.length; i++) {
            IMessageRegistry.Message memory msg_ = messageRegistry.getMessage(curated[i]);
            if (msg_.likeCount < minLikes || 
                (msg_.likeCount == minLikes && msg_.timestamp < minTimestamp)) {
                minLikes = msg_.likeCount;
                minTimestamp = msg_.timestamp;
                minIndex = i;
            }
        }
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
     * @notice Update MessageRegistry address (only DEFAULT_ADMIN_ROLE can call)
     * @dev This function is used to fix address mismatch after deployment
     * @param _messageRegistry New MessageRegistry address
     */
    function setMessageRegistry(address _messageRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_messageRegistry != address(0), "CurationModule: invalid address");
        address oldAddress = address(messageRegistry);
        messageRegistry = IMessageRegistry(_messageRegistry);
        emit MessageRegistryUpdated(oldAddress, _messageRegistry);
    }

    /**
     * @notice Finalize curated messages (only OPERATOR or NFTMinter can call)
     * @param topicId Topic ID
     */
    function finalizeCuratedMessages(uint256 topicId) external onlyRole(OPERATOR_ROLE) {
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(
            topic.status == ITopicFactory.TopicStatus.Closed ||
            topic.status == ITopicFactory.TopicStatus.Minted,
            "CurationModule: topic not closed"
        );
        require(!finalized[topicId], "CurationModule: already finalized");

        finalized[topicId] = true;

        // If curated messages are less than limit, fill with highest VP consumption
        uint256[] storage curated = curatedMessages[topicId];
        if (curated.length < topic.curatedLimit) {
            _fillWithVpConsumption(topicId, topic.curatedLimit);
        }

        emit CuratedMessagesFinalized(topicId);
    }

    /**
     * @notice Fill curated messages with highest VP consumption messages
     * @param topicId Topic ID
     * @param targetCount Target count
     */
    function _fillWithVpConsumption(uint256 topicId, uint256 targetCount) internal {
        uint256 messageCount = messageRegistry.getMessageCount(topicId);
        if (messageCount == 0) return;

        uint256[] storage curated = curatedMessages[topicId];
        uint256 needed = targetCount - curated.length;
        if (needed == 0) return;

        // Get messages not already in curated, sorted by VP cost
        // Use a simple approach: find top N by VP cost
        for (uint256 added = 0; added < needed && added < messageCount; ) {
            uint256 maxVpCost = 0;
            uint256 maxVpMessageId = 0;

            // Find message with highest VP cost not in curated
            uint256 batchEnd = messageCount < MAX_BATCH_SIZE ? messageCount : MAX_BATCH_SIZE;
            IMessageRegistry.Message[] memory msgs = messageRegistry.getMessagesByTopic(topicId, 0, batchEnd);
            
            for (uint256 i = 0; i < msgs.length; i++) {
                if (!isInCurated[topicId][msgs[i].messageId] && msgs[i].vpCost > maxVpCost) {
                    maxVpCost = msgs[i].vpCost;
                    maxVpMessageId = msgs[i].messageId;
                }
            }

            if (maxVpMessageId == 0) break;

            curated.push(maxVpMessageId);
            isInCurated[topicId][maxVpMessageId] = true;
            emit CuratedMessageAdded(topicId, maxVpMessageId);
            added++;
        }
    }
}
