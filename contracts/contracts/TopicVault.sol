// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title TopicVault
 * @notice Manages topic-scoped VP generation and tracks VP consumption for refunds
 */
contract TopicVault is AccessControl, ReentrancyGuard, ITopicVault {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ITopicFactory public topicFactory;
    IVPToken public vpToken;

    // Topic-scoped VP balances: topicId => user => balance
    mapping(uint256 => mapping(address => uint256)) public balances;

    // Track users who participated in each topic
    mapping(uint256 => address[]) public topicParticipants;
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    // Track VP consumption per user per topic (for refund)
    mapping(uint256 => mapping(address => uint256)) public consumedVP;

    // Track if VP has been refunded for a topic
    mapping(uint256 => bool) public vpRefunded;

    // MessageRegistry address (set by admin)
    address public messageRegistry;

    event VdotLocked(uint256 indexed topicId, address indexed user, uint256 vdotAmount, uint256 vpAmount);
    event VPBurned(uint256 indexed topicId, address indexed user, uint256 amount);
    event VPRefunded(uint256 indexed topicId, address indexed user, uint256 amount);
    event MessageRegistryUpdated(address indexed oldAddress, address indexed newAddress);

    constructor(address _topicFactory, address _vpToken, address initialOwner) {
        require(_topicFactory != address(0), "TopicVault: invalid topic factory");
        require(_vpToken != address(0), "TopicVault: invalid vp token");
        require(initialOwner != address(0), "TopicVault: invalid owner");
        
        topicFactory = ITopicFactory(_topicFactory);
        vpToken = IVPToken(_vpToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
    }

    /**
     * @notice Set MessageRegistry address
     * @param _messageRegistry MessageRegistry address
     */
    function setMessageRegistry(address _messageRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_messageRegistry != address(0), "TopicVault: invalid address");
        address oldAddress = messageRegistry;
        messageRegistry = _messageRegistry;
        emit MessageRegistryUpdated(oldAddress, _messageRegistry);
    }

    /**
     * @notice Lock vDOT to get topic-scoped VP
     * @param topicId Topic ID
     * @param amount Amount of vDOT (used for VP calculation, not actually locked)
     * @return vpAmount Amount of topic-scoped VP minted
     * @dev User must have sufficient global VP balance. Global VP will be burned and converted to topic-scoped VP.
     */
    function lockVdot(uint256 topicId, uint256 amount) external nonReentrant returns (uint256 vpAmount) {
        require(amount > 0, "TopicVault: amount must be greater than 0");

        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(topic.status == ITopicFactory.TopicStatus.Live, "TopicVault: topic not live");

        // Calculate required global VP (based on vDOT amount)
        uint256 requiredGlobalVP = vpToken.calculateVP(amount);

        // Check and burn global VP
        require(vpToken.balanceOf(msg.sender) >= requiredGlobalVP, "TopicVault: insufficient global VP");
        vpToken.burn(msg.sender, requiredGlobalVP);

        // Calculate and allocate topic-scoped VP
        vpAmount = vpToken.calculateVP(amount);
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

    /**
     * @notice Burn topic-scoped VP (only MessageRegistry can call)
     * @param topicId Topic ID
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(uint256 topicId, address from, uint256 amount) external {
        require(msg.sender == messageRegistry, "TopicVault: unauthorized");
        require(balances[topicId][from] >= amount, "TopicVault: insufficient balance");
        
        balances[topicId][from] -= amount;
        consumedVP[topicId][from] += amount;

        // Track participation for refund
        if (!hasParticipated[topicId][from]) {
            topicParticipants[topicId].push(from);
            hasParticipated[topicId][from] = true;
        }

        emit VPBurned(topicId, from, amount);
    }

    /**
     * @notice Check if user can redeem vDOT
     * @param user User address
     * @return True if can redeem
     */
    function canRedeem(address user) public view returns (bool) {
        return topicFactory.canUserRedeem(user);
    }

    /**
     * @notice Redeem vDOT (requires all topics user participated in are closed)
     * @dev This function is kept for compatibility but VP refund is now handled by NFTMinter
     */
    function redeemVdot() external nonReentrant {
        require(canRedeem(msg.sender), "TopicVault: cannot redeem yet");
        // VP refund is now handled by NFTMinter when minting NFT
        // This function only serves as a check that user can redeem
    }

    /**
     * @notice Refund VP to all participants (called by NFTMinter)
     * @param topicId Topic ID
     */
    function refundVPForTopic(uint256 topicId) external onlyRole(OPERATOR_ROLE) {
        require(!vpRefunded[topicId], "TopicVault: already refunded");
        
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);
        require(
            topic.status == ITopicFactory.TopicStatus.Closed ||
            topic.status == ITopicFactory.TopicStatus.Minted,
            "TopicVault: topic not closed"
        );

        vpRefunded[topicId] = true;

        // Refund VP to all participants
        address[] memory participants = topicParticipants[topicId];
        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            uint256 refundAmount = consumedVP[topicId][participant];

            if (refundAmount > 0) {
                consumedVP[topicId][participant] = 0; // Clear before mint to prevent reentrancy
                vpToken.mint(participant, refundAmount);
                emit VPRefunded(topicId, participant, refundAmount);
            }
        }
    }
}
