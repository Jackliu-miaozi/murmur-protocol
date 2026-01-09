// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/ICurationModule.sol";
import "./interfaces/IMessageRegistry.sol";
import "./interfaces/ITopicVault.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title NFTMinter
 * @notice Mints NFT memories for closed topics and refunds VP to participants
 */
contract NFTMinter is ERC721, Ownable, ReentrancyGuard {
    ITopicFactory public topicFactory;
    ICurationModule public curationModule;
    IMessageRegistry public messageRegistry;
    ITopicVault public topicVault;
    IVPToken public vpToken;

    // NFT counter
    uint256 private _tokenIdCounter;

    // Topic to NFT mapping
    mapping(uint256 => uint256) public topicToTokenId;

    // NFT metadata
    mapping(uint256 => NFTMetadata) public tokenMetadata;

    // Track if user has posted in topic (for authorization)
    mapping(uint256 => mapping(address => bool)) public topicParticipants;

    // Version
    string public constant VERSION = "1.0.0";

    struct NFTMetadata {
        uint256 topicId;
        bytes32 topicHash;
        bytes32 curatedHash;
        string version;
    }

    event NFTMinted(
        uint256 indexed tokenId,
        uint256 indexed topicId,
        bytes32 topicHash,
        bytes32 curatedHash
    );
    event VPRefunded(address indexed user, uint256 indexed topicId, uint256 amount);

    constructor(
        address _topicFactory,
        address _curationModule,
        address _messageRegistry,
        address _topicVault,
        address _vpToken,
        address initialOwner
    ) ERC721("Murmur Memory", "MURMUR") Ownable(initialOwner) {
        topicFactory = ITopicFactory(_topicFactory);
        curationModule = ICurationModule(_curationModule);
        messageRegistry = IMessageRegistry(_messageRegistry);
        topicVault = ITopicVault(_topicVault);
        vpToken = IVPToken(_vpToken);
    }

    /**
     * @notice Mint NFT for a closed topic
     * @param topicId Topic ID
     * @return tokenId Minted NFT token ID
     */
    function mintNfts(uint256 topicId) external nonReentrant returns (uint256 tokenId) {
        ITopicFactory.Topic memory topic = topicFactory.getTopic(topicId);

        // Check topic is closed
        require(
            topic.status == ITopicFactory.TopicStatus.Closed,
            "NFTMinter: topic not closed"
        );

        // Check not already minted
        require(!topic.minted, "NFTMinter: already minted");

        // Check caller has posted in this topic (authorization)
        // Get all messages and check if user is author
        bool hasPosted = false;
        uint256 messageCount = messageRegistry.getMessageCount(topicId);
        for (uint256 i = 0; i < messageCount; i++) {
            IMessageRegistry.Message[] memory messages = messageRegistry.getMessagesByTopic(
                topicId,
                i,
                1
            );
            if (messages.length > 0 && messages[0].author == msg.sender) {
                hasPosted = true;
                break;
            }
        }
        require(hasPosted, "NFTMinter: not authorized (must have posted in topic)");

        // Finalize curated messages if not already
        if (!curationModule.finalized(topicId)) {
            curationModule.finalizeCuratedMessages(topicId);
        }

        // Get curated set hash
        bytes32 curatedHash = curationModule.curatedSetHash(topicId);

        // Mint NFT
        tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);

        // Store metadata
        tokenMetadata[tokenId] = NFTMetadata({
            topicId: topicId,
            topicHash: topic.metadataHash,
            curatedHash: curatedHash,
            version: VERSION
        });

        topicToTokenId[topicId] = tokenId;

        // Mark topic as minted
        topicFactory.markMinted(topicId);

        emit NFTMinted(tokenId, topicId, topic.metadataHash, curatedHash);

        // Refund VP to all participants
        _refundVP(topicId);
    }

    /**
     * @notice Refund VP to all participants
     * @param topicId Topic ID
     */
    function _refundVP(uint256 topicId) internal {
        // Get all participants
        address[] memory participants = topicVault.getTopicParticipants(topicId);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            uint256 consumedVP = topicVault.getConsumedVP(topicId, participant);

            if (consumedVP > 0) {
                // Mint VP back to user in global VPToken
                vpToken.mint(participant, consumedVP);
                emit VPRefunded(participant, topicId, consumedVP);
            }
        }
    }

    /**
     * @notice Get NFT metadata
     * @param tokenId Token ID
     * @return metadata NFT metadata
     */
    function getMetadata(uint256 tokenId) external view returns (NFTMetadata memory metadata) {
        require(_ownerOf(tokenId) != address(0), "NFTMinter: token does not exist");
        return tokenMetadata[tokenId];
    }

    /**
     * @notice Get token URI (for OpenSea compatibility)
     * @param tokenId Token ID
     * @return uri Token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory uri) {
        require(_ownerOf(tokenId) != address(0), "NFTMinter: token does not exist");
        NFTMetadata memory metadata = tokenMetadata[tokenId];
        
        // Return JSON metadata
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                _base64Encode(
                    abi.encodePacked(
                        '{"name":"Murmur Memory #',
                        _toString(tokenId),
                        '","description":"A curated memory from Murmur Protocol","attributes":[',
                        '{"trait_type":"Topic ID","value":',
                        _toString(metadata.topicId),
                        '},{"trait_type":"Version","value":"',
                        metadata.version,
                        '"}',
                        '],"image":"',
                        _getImageUrl(metadata.topicHash, metadata.curatedHash),
                        '"}'
                    )
                )
            )
        );
    }

    /**
     * @notice Get image URL (placeholder - should be replaced with actual IPFS/HTTP URL)
     */
    function _getImageUrl(bytes32 topicHash, bytes32 curatedHash) internal pure returns (string memory) {
        // Placeholder - in production, generate or store actual image URL
        return "https://murmur.protocol/nft/placeholder.png";
    }

    /**
     * @notice Base64 encode
     */
    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        // Simplified base64 encoding (for production, use a library)
        return "";
    }

    /**
     * @notice Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
