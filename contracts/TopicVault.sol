// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title TopicVault
 * @notice Manages topic-scoped VP generation and redemption
 */
contract TopicVault is Ownable, ReentrancyGuard, ITopicVault {
    ITopicFactory public topicFactory;
    IVPToken public vpToken;

    // Topic-scoped VP balances: topicId => user => balance
    mapping(uint256 => mapping(address => uint256)) public balances;

    // Track users who participated in each topic
    mapping(uint256 => address[]) public topicParticipants;
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    // Track VP consumption per user per topic (for refund)
    mapping(uint256 => mapping(address => uint256)) public consumedVP;

    // VP calculation constant: VP = k * sqrt(vDOT), where k = 100
    uint256 public constant K = 100;
    uint256 private constant PRECISION = 1e18;

    event VdotLocked(uint256 indexed topicId, address indexed user, uint256 vdotAmount, uint256 vpAmount);
    event VPBurned(uint256 indexed topicId, address indexed user, uint256 amount);
    event VPRedeemed(address indexed user);

    constructor(address _topicFactory, address _vpToken, address initialOwner) Ownable(initialOwner) {
        topicFactory = ITopicFactory(_topicFactory);
        vpToken = IVPToken(_vpToken);
    }

    /**
     * @notice Lock vDOT to get topic-scoped VP
     * @param topicId Topic ID
     * @param amount Amount of vDOT (not actually locked, just for VP calculation)
     * @return vpAmount Amount of VP minted
     */
    function lockVdot(uint256 topicId, uint256 amount) external returns (uint256 vpAmount) {
        require(amount > 0, "TopicVault: amount must be greater than 0");

        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(topic.status == ITopicFactory.TopicStatus.Live, "TopicVault: topic not live");

        // Calculate VP: VP = 100 * sqrt(vDOT)
        vpAmount = calculateVP(amount);

        // Update balance
        balances[topicId][msg.sender] += vpAmount;

        // Track participation
        if (!hasParticipated[topicId][msg.sender]) {
            topicParticipants[topicId].push(msg.sender);
            hasParticipated[topicId][msg.sender] = true;
        }

        emit VdotLocked(topicId, msg.sender, amount, vpAmount);
    }

    /**
     * @notice Get topic-scoped VP balance
     * @param topicId Topic ID
     * @param user User address
     * @return balance VP balance
     */
    function balanceOf(uint256 topicId, address user) external view returns (uint256 balance) {
        return balances[topicId][user];
    }

    // MessageRegistry address (set by owner)
    address public messageRegistry;

    /**
     * @notice Set MessageRegistry address
     * @param _messageRegistry MessageRegistry address
     */
    function setMessageRegistry(address _messageRegistry) external onlyOwner {
        messageRegistry = _messageRegistry;
    }

    /**
     * @notice Burn topic-scoped VP
     * @param topicId Topic ID
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(uint256 topicId, address from, uint256 amount) external {
        // Only MessageRegistry can burn
        require(msg.sender == messageRegistry, "TopicVault: unauthorized");

        require(balances[topicId][from] >= amount, "TopicVault: insufficient balance");
        balances[topicId][from] -= amount;
        consumedVP[topicId][from] += amount;

        emit VPBurned(topicId, from, amount);
    }

    /**
     * @notice Check if user can redeem vDOT
     * @param user User address
     * @return canRedeem True if can redeem
     */
    function canRedeem(address user) external view returns (bool canRedeem) {
        return topicFactory.canUserRedeem(user);
    }

    /**
     * @notice Redeem vDOT (requires all topics user participated in are closed)
     */
    function redeemVdot() external nonReentrant {
        require(canRedeem(msg.sender), "TopicVault: cannot redeem yet");

        // Get user's topics
        uint256[] memory userTopics_ = topicFactory.getUserTopics(msg.sender);

        // Refund VP for all topics
        for (uint256 i = 0; i < userTopics_.length; i++) {
            uint256 topicId = userTopics_[i];
            uint256 refundAmount = consumedVP[topicId][msg.sender];

            if (refundAmount > 0) {
                // Mint VP back to user in global VPToken
                vpToken.mint(msg.sender, refundAmount);
                consumedVP[topicId][msg.sender] = 0;
            }
        }

        emit VPRedeemed(msg.sender);
    }

    /**
     * @notice Get consumed VP for refund calculation
     * @param topicId Topic ID
     * @param user User address
     * @return amount Consumed VP amount
     */
    function getConsumedVP(uint256 topicId, address user) external view returns (uint256 amount) {
        return consumedVP[topicId][user];
    }

    /**
     * @notice Get topic participants
     * @param topicId Topic ID
     * @return participants Array of participant addresses
     */
    function getTopicParticipants(uint256 topicId) external view returns (address[] memory participants) {
        return topicParticipants[topicId];
    }

    /**
     * @notice Calculate VP amount from vDOT amount
     * @param vdotAmount Amount of vDOT
     * @return vpAmount Amount of VP
     * @dev VP = 100 * sqrt(vDOT)
     */
    function calculateVP(uint256 vdotAmount) public pure returns (uint256 vpAmount) {
        // VP = 100 * sqrt(vDOT)
        // Using fixed point math: sqrt(vdotAmount * PRECISION) * 100 / sqrt(PRECISION)
        uint256 sqrtVdot = sqrt(vdotAmount * PRECISION);
        vpAmount = (sqrtVdot * K) / sqrt(PRECISION);
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Input value
     * @return sqrt Square root
     */
    function sqrt(uint256 x) internal pure returns (uint256 sqrt_) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @notice Set MessageRegistry address for authorization
     * @param messageRegistry MessageRegistry address
     */
    function setMessageRegistry(address messageRegistry) external onlyOwner {
        // This allows MessageRegistry to call burn
        // In production, use a proper access control pattern
    }
}
