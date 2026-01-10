// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITopicFactory.sol";
import "./interfaces/ICurationModule.sol";
import "./interfaces/IMessageRegistry.sol";
import "./interfaces/ITopicVault.sol";

/**
 * @title NFTMinter
 * @notice Mints NFT memories for closed topics and triggers VP refunds
 */
contract NFTMinter is ERC721, AccessControl, ReentrancyGuard {
    using Strings for uint256;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ITopicFactory public topicFactory;
    ICurationModule public curationModule;
    IMessageRegistry public messageRegistry;
    ITopicVault public topicVault;

    // NFT counter
    uint256 private _tokenIdCounter;

    // Topic to NFT mapping
    mapping(uint256 => uint256) public topicToTokenId;

    // NFT metadata
    mapping(uint256 => NFTMetadata) public tokenMetadata;

    // Version
    string public constant VERSION = "1.0.0";

    // Base URI for images
    string public baseImageURI = "https://murmur.protocol/nft/";

    struct NFTMetadata {
        uint256 topicId;
        bytes32 topicHash;
        bytes32 curatedHash;
        string version;
        uint256 mintedAt;
        address mintedBy;
    }

    event NFTMinted(
        uint256 indexed tokenId,
        uint256 indexed topicId,
        address indexed minter,
        bytes32 topicHash,
        bytes32 curatedHash
    );
    event BaseImageURIUpdated(string newURI);

    constructor(
        address _topicFactory,
        address _curationModule,
        address _messageRegistry,
        address _topicVault,
        address initialOwner
    ) ERC721("Murmur Memory", "MURMUR") {
        require(_topicFactory != address(0), "NFTMinter: invalid topic factory");
        require(_curationModule != address(0), "NFTMinter: invalid curation module");
        require(_messageRegistry != address(0), "NFTMinter: invalid message registry");
        require(_topicVault != address(0), "NFTMinter: invalid topic vault");
        require(initialOwner != address(0), "NFTMinter: invalid owner");
        
        topicFactory = ITopicFactory(_topicFactory);
        curationModule = ICurationModule(_curationModule);
        messageRegistry = IMessageRegistry(_messageRegistry);
        topicVault = ITopicVault(_topicVault);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
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
        require(
            messageRegistry.hasUserPostedInTopic(topicId, msg.sender),
            "NFTMinter: not authorized (must have posted in topic)"
        );

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
            version: VERSION,
            mintedAt: block.timestamp,
            mintedBy: msg.sender
        });

        topicToTokenId[topicId] = tokenId;

        // Mark topic as minted
        topicFactory.markMinted(topicId);

        emit NFTMinted(tokenId, topicId, msg.sender, topic.metadataHash, curatedHash);

        // Trigger VP refund
        topicVault.refundVPForTopic(topicId);
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
     * @return Token URI with JSON metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "NFTMinter: token does not exist");
        NFTMetadata memory metadata = tokenMetadata[tokenId];
        
        string memory json = string(
            abi.encodePacked(
                '{"name":"Murmur Memory #',
                tokenId.toString(),
                '","description":"A curated memory from Murmur Protocol - Topic ',
                metadata.topicId.toString(),
                '","attributes":[',
                '{"trait_type":"Topic ID","value":"',
                metadata.topicId.toString(),
                '"},{"trait_type":"Version","value":"',
                metadata.version,
                '"},{"trait_type":"Minted At","display_type":"date","value":',
                metadata.mintedAt.toString(),
                '}',
                '],"image":"',
                _getImageUrl(tokenId, metadata.topicHash),
                '"}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /**
     * @notice Get image URL for NFT
     * @param tokenId Token ID
     * @dev topicHash parameter reserved for future use
     * @return Image URL
     */
    function _getImageUrl(uint256 tokenId, bytes32 /* topicHash */) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                baseImageURI,
                tokenId.toString(),
                ".png"
            )
        );
    }

    /**
     * @notice Set base image URI
     * @param newURI New base URI
     */
    function setBaseImageURI(string memory newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseImageURI = newURI;
        emit BaseImageURIUpdated(newURI);
    }

    /**
     * @notice Check if contract supports interface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
