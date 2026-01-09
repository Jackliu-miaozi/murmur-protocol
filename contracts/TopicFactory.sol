// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title TopicFactory
 * @notice Manages topic creation, lifecycle, and state transitions
 */
contract TopicFactory is Ownable, ReentrancyGuard, ITopicFactory {
    IVPToken public vpToken;

    // Topic counter
    uint256 public topicCounter;

    // Topic storage
    mapping(uint256 => Topic) public topics;

    // Active topic count (Live and not expired)
    uint256 public activeTopicCount;

    // Creation cost parameters
    uint256 public baseCreationCost = 1000 * 1e18; // 1000 VP (with 18 decimals)
    uint256 public alpha = 2 * 1e18; // 2.0 (scaled to 1e18)

    // Track user's participated topics
    mapping(address => uint256[]) public userTopics;

    event TopicCreated(
        uint256 indexed topicId,
        address indexed creator,
        bytes32 metadataHash,
        uint256 duration,
        uint256 freezeWindow,
        uint256 curatedLimit
    );
    event TopicClosed(uint256 indexed topicId);
    event TopicMinted(uint256 indexed topicId);
    event TopicSettled(uint256 indexed topicId);
    event CreationCostUpdated(uint256 baseCost, uint256 alpha);

    constructor(address _vpToken, address initialOwner) Ownable(initialOwner) {
        vpToken = IVPToken(_vpToken);
    }

    /**
     * @notice Create a new topic
     * @param metadataHash Hash of topic metadata
     * @param topicDuration_ Topic duration in seconds
     * @param freezeWindow_ Freeze window in seconds
     * @param curatedLimit_ Maximum number of curated messages
     * @return topicId Created topic ID
     */
    function createTopic(
        bytes32 metadataHash,
        uint256 topicDuration_,
        uint256 freezeWindow_,
        uint256 curatedLimit_
    ) external nonReentrant returns (uint256 topicId) {
        require(topicDuration_ > 0, "TopicFactory: invalid duration");
        require(freezeWindow_ < topicDuration_, "TopicFactory: invalid freeze window");
        require(curatedLimit_ > 0, "TopicFactory: invalid curated limit");

        // Calculate creation cost
        uint256 cost = quoteCreationCost();

        // Check and burn VP
        require(vpToken.balanceOf(msg.sender) >= cost, "TopicFactory: insufficient VP");
        vpToken.burn(msg.sender, cost);

        // Create topic
        topicId = ++topicCounter;
        topics[topicId] = Topic({
            topicId: topicId,
            creator: msg.sender,
            metadataHash: metadataHash,
            createdAt: block.timestamp,
            duration: topicDuration_,
            freezeWindow: freezeWindow_,
            curatedLimit: curatedLimit_,
            status: TopicStatus.Live,
            minted: false
        });

        // Track user's topics
        userTopics[msg.sender].push(topicId);

        // Update active count
        activeTopicCount++;

        emit TopicCreated(topicId, msg.sender, metadataHash, topicDuration_, freezeWindow_, curatedLimit_);
    }

    /**
     * @notice Quote creation cost
     * @return cost Creation cost in VP
     */
    function quoteCreationCost() public view returns (uint256 cost) {
        // cost = baseCost * (1 + alpha * log(1 + activeTopicCount))
        // Using fixed point math
        if (activeTopicCount == 0) {
            return baseCreationCost;
        }

        // log(1 + activeTopicCount) approximation
        uint256 logTerm = logApprox(1 + activeTopicCount);
        uint256 multiplier = 1e18 + (alpha * logTerm) / 1e18;
        cost = (baseCreationCost * multiplier) / 1e18;
    }

    /**
     * @notice Get topic information
     * @param topicId Topic ID
     * @return topic Topic struct
     */
    function getTopic(uint256 topicId) external view returns (Topic memory topic) {
        topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
    }

    /**
     * @notice Check if topic is frozen (in freeze window)
     * @param topicId Topic ID
     * @return isFrozen True if frozen
     */
    function isFrozen(uint256 topicId) public view returns (bool isFrozen) {
        Topic memory topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");

        if (topic.status != TopicStatus.Live) {
            return false;
        }

        uint256 elapsed = block.timestamp - topic.createdAt;
        uint256 freezeStart = topic.duration - topic.freezeWindow;
        isFrozen = (elapsed >= freezeStart);
    }

    /**
     * @notice Check if topic is expired
     * @param topicId Topic ID
     * @return isExpired True if expired
     */
    function isExpired(uint256 topicId) public view returns (bool isExpired) {
        Topic memory topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");

        if (topic.status != TopicStatus.Live) {
            return false;
        }

        uint256 elapsed = block.timestamp - topic.createdAt;
        isExpired = (elapsed >= topic.duration);
    }

    /**
     * @notice Check and close topic if expired (called by MessageRegistry)
     * @param topicId Topic ID
     */
    function checkAndCloseTopic(uint256 topicId) external {
        Topic storage topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
        require(topic.status == TopicStatus.Live, "TopicFactory: topic not live");

        if (isExpired(topicId)) {
            topic.status = TopicStatus.Closed;
            activeTopicCount--;
            emit TopicClosed(topicId);
        }
    }

    /**
     * @notice Close topic manually (for backend service)
     * @param topicId Topic ID
     */
    function closeTopic(uint256 topicId) external {
        Topic storage topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
        require(topic.status == TopicStatus.Live, "TopicFactory: topic not live");
        require(isExpired(topicId), "TopicFactory: topic not expired");

        topic.status = TopicStatus.Closed;
        activeTopicCount--;
        emit TopicClosed(topicId);
    }

    /**
     * @notice Mark topic as minted
     * @param topicId Topic ID
     */
    function markMinted(uint256 topicId) external {
        Topic storage topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
        require(topic.status == TopicStatus.Closed, "TopicFactory: topic not closed");
        require(!topic.minted, "TopicFactory: already minted");

        topic.minted = true;
        topic.status = TopicStatus.Minted;
        emit TopicMinted(topicId);
    }

    /**
     * @notice Get user's participated topics
     * @param user User address
     * @return topicIds Array of topic IDs
     */
    function getUserTopics(address user) external view returns (uint256[] memory topicIds) {
        return userTopics[user];
    }

    /**
     * @notice Check if user can redeem (all topics are closed/minted/settled)
     * @param user User address
     * @return canRedeem True if can redeem
     */
    function canUserRedeem(address user) external view returns (bool canRedeem) {
        uint256[] memory topics_ = userTopics[user];
        for (uint256 i = 0; i < topics_.length; i++) {
            Topic memory topic = topics[topics_[i]];
            if (topic.status == TopicStatus.Live) {
                return false;
            }
        }
        return true;
    }

    /**
     * @notice Update creation cost parameters
     * @param _baseCost Base creation cost
     * @param _alpha Alpha coefficient
     */
    function updateCreationCost(uint256 _baseCost, uint256 _alpha) external onlyOwner {
        baseCreationCost = _baseCost;
        alpha = _alpha;
        emit CreationCostUpdated(_baseCost, _alpha);
    }

    /**
     * @notice Logarithm approximation (natural log)
     * @param x Input value
     * @return result Logarithm result (scaled to 1e18)
     */
    function logApprox(uint256 x) internal pure returns (uint256 result) {
        require(x > 0, "TopicFactory: log of zero");
        // Simple approximation: log(x) ≈ (x - 1) / x for x close to 1
        // Better: use Taylor series or lookup table
        // For simplicity, using: log(1+x) ≈ x - x^2/2 + x^3/3 - ...
        if (x == 1) return 0;
        if (x < 1) {
            // log(x) = -log(1/x)
            return 1e18 - logApprox((1e18 * 1e18) / x);
        }

        // For x > 1, use approximation
        uint256 n = 0;
        uint256 y = x;
        while (y >= 2) {
            y = y / 2;
            n++;
        }
        // log(x) = n * log(2) + log(y)
        // log(2) ≈ 0.693147
        uint256 log2 = 693147000000000000; // 0.693147 * 1e18
        result = n * log2;
        if (y > 1) {
            uint256 term = ((y - 1e18) * 1e18) / y;
            result += term;
        }
    }
}
