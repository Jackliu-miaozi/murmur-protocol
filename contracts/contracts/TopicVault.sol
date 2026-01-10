// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title TopicVault
 * @notice Tracks VP consumption per topic for refunds (users now use global VP directly)
 */
contract TopicVault is AccessControl, ReentrancyGuard, ITopicVault {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ITopicFactory public topicFactory;
    IVPToken public vpToken;

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
     * @notice Lock vDOT to get topic-scoped VP (DEPRECATED)
     * @dev This function is deprecated. Users now use global VP directly from VPToken contract.
     *      This function is kept for backward compatibility but should not be used.
     */
    function lockVdot(uint256 topicId, uint256 amount) external nonReentrant returns (uint256 vpAmount) {
        revert("TopicVault: lockVdot is deprecated, use global VP directly");
    }

    /**
     * @notice Get topic-scoped VP balance (DEPRECATED)
     * @dev Users now use global VP directly. This function always returns 0 for backward compatibility.
     * @param topicId Topic ID
     * @param user User address
     * @return balance Always returns 0
     */
    function balanceOf(uint256 topicId, address user) external pure returns (uint256 balance) {
        return 0;
    }

    /**
     * @notice Record VP consumption for a topic (only MessageRegistry can call)
     * @dev This function tracks VP consumption for refund purposes. VP is burned directly from VPToken.
     * @param topicId Topic ID
     * @param from Address that consumed VP
     * @param amount Amount of VP consumed
     */
    function recordVpConsumption(uint256 topicId, address from, uint256 amount) external {
        require(msg.sender == messageRegistry, "TopicVault: unauthorized");
        require(amount > 0, "TopicVault: amount must be greater than 0");
        
        consumedVP[topicId][from] += amount;

        // Track participation for refund
        if (!hasParticipated[topicId][from]) {
            topicParticipants[topicId].push(from);
            hasParticipated[topicId][from] = true;
        }

        emit VPBurned(topicId, from, amount);
    }

    /**
     * @notice Burn topic-scoped VP (DEPRECATED - use recordVpConsumption instead)
     * @dev This function is kept for backward compatibility but always reverts.
     *      Use recordVpConsumption() instead.
     */
    function burn(uint256 topicId, address from, uint256 amount) external {
        revert("TopicVault: burn is deprecated, use recordVpConsumption instead");
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
