// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMessageRegistry.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/IAIScoreVerifier.sol";
import "./interfaces/ICurationModule.sol";

/**
 * @title MessageRegistry
 * @notice Manages message posting, liking, and cost calculation
 */
contract MessageRegistry is Ownable, ReentrancyGuard, IMessageRegistry {
    ITopicFactory public topicFactory;
    ITopicVault public topicVault;
    IAIScoreVerifier public aiVerifier;
    ICurationModule public curationModule;

    // Message storage
    mapping(uint256 => Message) public messages;
    uint256 public messageCounter;

    // Topic message IDs
    mapping(uint256 => uint256[]) public topicMessages;

    // Rate limiting: user => last message timestamp
    mapping(address => uint256) public lastMessageTime;
    mapping(address => uint256) public consecutiveMessageCount;
    mapping(address => uint256) public lastMessageResetTime;

    // Cost calculation parameters
    uint256 public constant C0 = 10 * 1e18; // Base cost: 10 VP
    uint256 public constant BETA = 25 * 1e16; // 0.25 (scaled to 1e18)
    uint256 public constant ALPHA = 2 * 1e18; // 2.0 (scaled to 1e18)
    uint256 public constant P = 2 * 1e18; // 2.0 (scaled to 1e18)
    uint256 public constant GAMMA = 15 * 1e16; // 0.15 (scaled to 1e18)

    // Rate limiting parameters
    uint256 public constant MIN_INTERVAL = 15; // 15 seconds
    uint256 public constant CONSECUTIVE_COOLDOWN = 3; // Every 3 messages
    uint256 public constant COOLDOWN_MULTIPLIER = 11 * 1e17; // 1.1x (scaled to 1e18)

    // Like cost
    uint256 public constant LIKE_COST = 1 * 1e18; // 1 VP

    // Topic statistics for heat calculation
    mapping(uint256 => uint256) public topicMessageCount;
    mapping(uint256 => uint256) public topicLikeCount;
    mapping(uint256 => uint256) public topicVpBurned;
    mapping(uint256 => uint256) public topicStartTime;
    mapping(uint256 => mapping(address => bool)) public topicUniqueUsers;
    mapping(uint256 => uint256) public topicUniqueUserCount;

    event MessagePosted(
        uint256 indexed messageId,
        uint256 indexed topicId,
        address indexed author,
        bytes32 contentHash,
        uint256 vpCost
    );
    event MessageLiked(uint256 indexed messageId, address indexed liker, uint256 likeCount);

    constructor(
        address _topicFactory,
        address _topicVault,
        address _aiVerifier,
        address _curationModule,
        address initialOwner
    ) Ownable(initialOwner) {
        topicFactory = ITopicFactory(_topicFactory);
        topicVault = ITopicVault(_topicVault);
        aiVerifier = IAIScoreVerifier(_aiVerifier);
        curationModule = ICurationModule(_curationModule);
    }

    /**
     * @notice Post a message
     * @param topicId Topic ID
     * @param contentHash Hash of message content
     * @param length Message length in characters
     * @param aiScore AI intensity score (0-1, scaled to 1e18)
     * @param timestamp Timestamp from AI service
     * @param signature AI service signature
     * @return messageId Created message ID
     */
    function postMessage(
        uint256 topicId,
        bytes32 contentHash,
        uint256 length,
        uint256 aiScore,
        uint256 timestamp,
        bytes memory signature
    ) external nonReentrant returns (uint256 messageId) {
        // Check topic status and auto-close if expired
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(topic.status == ITopicFactory.TopicStatus.Live, "MessageRegistry: topic not live");
        topicFactory.checkAndCloseTopic(topicId);

        // Verify AI signature
        require(
            aiVerifier.verifyScore(contentHash, length, aiScore, timestamp, signature),
            "MessageRegistry: invalid AI signature"
        );

        // Rate limiting
        require(
            block.timestamp >= lastMessageTime[msg.sender] + MIN_INTERVAL,
            "MessageRegistry: rate limit exceeded"
        );

        // Check consecutive message cooldown
        if (block.timestamp >= lastMessageResetTime[msg.sender] + 3600) {
            // Reset after 1 hour
            consecutiveMessageCount[msg.sender] = 0;
            lastMessageResetTime[msg.sender] = block.timestamp;
        }

        // Calculate message cost
        uint256 baseCost = calculateMessageCost(topicId, length, aiScore);

        // Apply consecutive cooldown multiplier
        if (consecutiveMessageCount[msg.sender] >= CONSECUTIVE_COOLDOWN) {
            baseCost = (baseCost * COOLDOWN_MULTIPLIER) / 1e18;
        }

        // Check and burn VP
        require(topicVault.balanceOf(topicId, msg.sender) >= baseCost, "MessageRegistry: insufficient VP");
        topicVault.burn(topicId, msg.sender, baseCost);

        // Update rate limiting
        lastMessageTime[msg.sender] = block.timestamp;
        consecutiveMessageCount[msg.sender]++;

        // Create message
        messageId = ++messageCounter;
        messages[messageId] = Message({
            messageId: messageId,
            topicId: topicId,
            author: msg.sender,
            contentHash: contentHash,
            length: length,
            aiScore: aiScore,
            timestamp: block.timestamp,
            likeCount: 0,
            vpCost: baseCost
        });

        topicMessages[topicId].push(messageId);

        // Update topic statistics
        topicMessageCount[topicId]++;
        topicVpBurned[topicId] += baseCost;
        if (!topicUniqueUsers[topicId][msg.sender]) {
            topicUniqueUsers[topicId][msg.sender] = true;
            topicUniqueUserCount[topicId]++;
        }
        if (topicStartTime[topicId] == 0) {
            topicStartTime[topicId] = block.timestamp;
        }

        emit MessagePosted(messageId, topicId, msg.sender, contentHash, baseCost);

        // Trigger curation update
        curationModule.onLike(topicId, messageId);
    }

    /**
     * @notice Like a message
     * @param topicId Topic ID
     * @param messageId Message ID
     */
    function likeMessage(uint256 topicId, uint256 messageId) external nonReentrant {
        Message storage message = messages[messageId];
        require(message.messageId != 0, "MessageRegistry: message not found");
        require(message.topicId == topicId, "MessageRegistry: topic mismatch");

        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(
            topic.status == ITopicFactory.TopicStatus.Live,
            "MessageRegistry: topic not live"
        );

        // Check and burn VP for like
        require(topicVault.balanceOf(topicId, msg.sender) >= LIKE_COST, "MessageRegistry: insufficient VP");
        topicVault.burn(topicId, msg.sender, LIKE_COST);

        // Update like count
        message.likeCount++;
        topicLikeCount[topicId]++;
        topicVpBurned[topicId] += LIKE_COST;

        emit MessageLiked(messageId, msg.sender, message.likeCount);

        // Trigger curation update
        curationModule.onLike(topicId, messageId);
    }

    /**
     * @notice Calculate message cost
     * @param topicId Topic ID
     * @param length Message length
     * @param aiScore AI intensity score (0-1, scaled to 1e18)
     * @return cost Message cost in VP
     */
    function calculateMessageCost(
        uint256 topicId,
        uint256 length,
        uint256 aiScore
    ) public view returns (uint256 cost) {
        // Calculate heat
        uint256 heat = calculateHeat(topicId);

        // Base(H) = c0 * (1 + beta * H)
        uint256 base = (C0 * (1e18 + (BETA * heat) / 1e18)) / 1e18;

        // Intensity(S) = 1 + alpha * S^p
        // S is already scaled to 1e18, so S^p = (S * S) / 1e18 for p=2
        uint256 sSquared = (aiScore * aiScore) / 1e18;
        uint256 intensity = 1e18 + (ALPHA * sSquared) / 1e18;

        // Length(L) = 1 + gamma * log(1 + L)
        uint256 lengthTerm = 1e18 + (GAMMA * logApprox(1 + length)) / 1e18;

        // Cost = Base * Intensity * Length
        cost = (base * intensity * lengthTerm) / (1e18 * 1e18);
    }

    /**
     * @notice Calculate topic heat
     * @param topicId Topic ID
     * @return heat Heat value (scaled to 1e18)
     */
    function calculateHeat(uint256 topicId) public view returns (uint256 heat) {
        uint256 elapsed = block.timestamp - topicStartTime[topicId];
        if (elapsed == 0) return 0;

        // Message rate (messages per second)
        uint256 msgRate = (topicMessageCount[topicId] * 1e18) / elapsed;

        // Like rate (likes per second)
        uint256 likeRate = (topicLikeCount[topicId] * 1e18) / elapsed;

        // VP burn rate (VP per second)
        uint256 vpBurnRate = (topicVpBurned[topicId] * 1e18) / elapsed;

        // Heat = w1*log(1+msg_rate) + w2*log(1+unique_users) + w3*log(1+like_rate) + w4*log(1+vp_burn_rate)
        // Using equal weights for simplicity
        uint256 w = 1e18 / 4; // Each weight is 0.25

        heat =
            (w * logApprox(1e18 + msgRate)) / 1e18 +
            (w * logApprox(1e18 + topicUniqueUserCount[topicId] * 1e18)) / 1e18 +
            (w * logApprox(1e18 + likeRate)) / 1e18 +
            (w * logApprox(1e18 + vpBurnRate)) / 1e18;
    }

    /**
     * @notice Get message information
     * @param messageId Message ID
     * @return message Message struct
     */
    function getMessage(uint256 messageId) external view returns (Message memory message) {
        message = messages[messageId];
        require(message.messageId != 0, "MessageRegistry: message not found");
    }

    /**
     * @notice Get message count for a topic
     * @param topicId Topic ID
     * @return count Message count
     */
    function getMessageCount(uint256 topicId) external view returns (uint256 count) {
        return topicMessages[topicId].length;
    }

    /**
     * @notice Get messages by topic
     * @param topicId Topic ID
     * @param offset Offset
     * @param limit Limit
     * @return messages_ Array of messages
     */
    function getMessagesByTopic(
        uint256 topicId,
        uint256 offset,
        uint256 limit
    ) external view returns (Message[] memory messages_) {
        uint256[] memory messageIds = topicMessages[topicId];
        uint256 total = messageIds.length;
        if (offset >= total) {
            return new Message[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        messages_ = new Message[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            messages_[i - offset] = messages[messageIds[i]];
        }
    }

    /**
     * @notice Logarithm approximation
     */
    function logApprox(uint256 x) internal pure returns (uint256 result) {
        require(x > 0, "MessageRegistry: log of zero");
        if (x == 1e18) return 0;

        // Simple approximation for log(1+x) where x is scaled to 1e18
        if (x < 1e18) {
            // log(1+x) ≈ x - x^2/2 for small x
            uint256 xMinusOne = x - 1e18;
            uint256 xSquared = (xMinusOne * xMinusOne) / 1e18;
            result = xMinusOne - xSquared / 2;
        } else {
            // For larger values, use iterative method
            uint256 n = 0;
            uint256 y = x;
            while (y >= 2 * 1e18) {
                y = y / 2;
                n++;
            }
            uint256 log2 = 693147000000000000; // log(2) * 1e18
            result = n * log2;
            if (y > 1e18) {
                uint256 term = ((y - 1e18) * 1e18) / y;
                result += term;
            }
        }
    }
}
