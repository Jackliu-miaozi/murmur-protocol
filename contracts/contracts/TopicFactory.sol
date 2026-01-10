// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title TopicFactory
 * @notice Manages topic creation, lifecycle, and state transitions
 */
contract TopicFactory is AccessControl, ReentrancyGuard, ITopicFactory {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant NFT_MINTER_ROLE = keccak256("NFT_MINTER_ROLE");

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

    // Track user participation in each topic
    mapping(uint256 => mapping(address => bool)) public userParticipated;

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
    event UserJoinedTopic(uint256 indexed topicId, address indexed user);

    constructor(address _vpToken, address initialOwner) {
        require(_vpToken != address(0), "TopicFactory: invalid vp token");
        require(initialOwner != address(0), "TopicFactory: invalid owner");
        
        vpToken = IVPToken(_vpToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
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
        require(metadataHash != bytes32(0), "TopicFactory: invalid metadata hash");
        require(topicDuration_ > 0, "TopicFactory: invalid duration");
        require(freezeWindow_ < topicDuration_, "TopicFactory: invalid freeze window");
        require(curatedLimit_ > 0 && curatedLimit_ <= 100, "TopicFactory: invalid curated limit");

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
        _addUserToTopic(topicId, msg.sender);

        // Update active count
        activeTopicCount++;

        emit TopicCreated(topicId, msg.sender, metadataHash, topicDuration_, freezeWindow_, curatedLimit_);
    }

    /**
     * @notice Add user to topic participation list
     * @param topicId Topic ID
     * @param user User address
     */
    function _addUserToTopic(uint256 topicId, address user) internal {
        if (!userParticipated[topicId][user]) {
            userParticipated[topicId][user] = true;
            userTopics[user].push(topicId);
            emit UserJoinedTopic(topicId, user);
        }
    }

    /**
     * @notice Quote creation cost
     * @return cost Creation cost in VP
     */
    function quoteCreationCost() public view returns (uint256 cost) {
        // cost = baseCost * (1 + alpha * log(1 + activeTopicCount))
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
     * @return frozen True if frozen
     */
    function isFrozen(uint256 topicId) public view returns (bool frozen) {
        Topic memory topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");

        if (topic.status != TopicStatus.Live) {
            return false;
        }

        uint256 elapsed = block.timestamp - topic.createdAt;
        uint256 freezeStart = topic.duration - topic.freezeWindow;
        frozen = (elapsed >= freezeStart);
    }

    /**
     * @notice Check if topic is expired
     * @param topicId Topic ID
     * @return expired True if expired
     */
    function isExpired(uint256 topicId) public view returns (bool expired) {
        Topic memory topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");

        if (topic.status != TopicStatus.Live) {
            return false;
        }

        uint256 elapsed = block.timestamp - topic.createdAt;
        expired = (elapsed >= topic.duration);
    }

    /**
     * @notice Check and close topic if expired
     * @param topicId Topic ID
     * @return closed True if topic was closed
     */
    function checkAndCloseTopic(uint256 topicId) external returns (bool closed) {
        Topic storage topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
        
        if (topic.status != TopicStatus.Live) {
            return false;
        }

        if (isExpired(topicId)) {
            topic.status = TopicStatus.Closed;
            activeTopicCount--;
            emit TopicClosed(topicId);
            return true;
        }
        return false;
    }

    /**
     * @notice Close topic manually (for backend service or admin)
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
     * @notice Mark topic as minted (only NFTMinter can call)
     * @param topicId Topic ID
     */
    function markMinted(uint256 topicId) external onlyRole(NFT_MINTER_ROLE) {
        Topic storage topic = topics[topicId];
        require(topic.topicId != 0, "TopicFactory: topic not found");
        require(topic.status == TopicStatus.Closed, "TopicFactory: topic not closed");
        require(!topic.minted, "TopicFactory: already minted");

        topic.minted = true;
        topic.status = TopicStatus.Minted;
        emit TopicMinted(topicId);
    }

    /**
     * @notice Check if user can redeem (all topics are closed/minted/settled)
     * @param user User address
     * @return canRedeem True if can redeem
     */
    function canUserRedeem(address user) external view returns (bool canRedeem) {
        uint256[] memory userTopicIds = userTopics[user];
        for (uint256 i = 0; i < userTopicIds.length; i++) {
            Topic memory topic = topics[userTopicIds[i]];
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
    function updateCreationCost(uint256 _baseCost, uint256 _alpha) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseCreationCost = _baseCost;
        alpha = _alpha;
        emit CreationCostUpdated(_baseCost, _alpha);
    }

    /**
     * @notice Logarithm approximation (natural log)
     * @param x Input value (must be >= 1)
     * @return result Logarithm result (scaled to 1e18)
     */
    function logApprox(uint256 x) internal pure returns (uint256 result) {
        require(x >= 1, "TopicFactory: log input must be >= 1");
        if (x == 1) return 0;

        // For x >= 2, use iterative method
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
        
        // For remaining y in [1, 2), use approximation log(y) ≈ (y-1) - (y-1)^2/2
        if (y > 1) {
            // Since we're using integers, y is always >= 1
            // y is effectively x / 2^n, so we estimate the fractional part
            result += (x * 1e18 / (1 << n)) - 1e18;
        }
    }
}
