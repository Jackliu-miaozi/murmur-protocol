// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MurmurNFTLite
 * @notice Lightweight NFT minter for Murmur Protocol (V2 Architecture)
 * @dev Simplified version without full ERC721 - uses minimal NFT implementation
 */
contract MurmurNFTLite is
  Initializable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable,
  UUPSUpgradeable
{
  using Strings for uint256;
  using ECDSA for bytes32;

  // Owner
  address public owner;

  // Operators (authorized backend signers)
  mapping(address => bool) public operators;

  // NFT counter
  uint256 private _tokenIdCounter;

  // Topic to NFT mapping
  mapping(uint256 => uint256) public topicToTokenId;

  // NFT metadata
  mapping(uint256 => NFTMetadata) public tokenMetadata;

  // Track minted topics
  mapping(uint256 => bool) public topicMinted;

  // Nonce for mint operations
  uint256 public mintNonce;

  // Version
  string public constant VERSION = "2.0.0";

  // Base URI
  string public baseImageURI = "https://murmur.protocol/nft/";

  // NFT ownership
  mapping(uint256 => address) public ownerOf;
  mapping(address => uint256) public balanceOf;

  struct NFTMetadata {
    uint256 topicId;
    bytes32 topicHash;
    bytes32 curatedHash;
    uint256 mintedAt;
    address mintedBy;
  }

  // EIP-712 type hash
  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintNFT(uint256 topicId,bytes32 topicHash,bytes32 curatedHash,uint256 nonce)"
    );

  event NFTMinted(
    uint256 indexed tokenId,
    uint256 indexed topicId,
    address indexed minter,
    bytes32 topicHash,
    bytes32 curatedHash
  );
  event BaseImageURIUpdated(string newURI);
  event OperatorUpdated(address indexed operator, bool status);
  event Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId
  );

  modifier onlyOwner() {
    require(msg.sender == owner, "NFT: not owner");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __ReentrancyGuard_init();
    __EIP712_init("MurmurNFT", "2");
    __UUPSUpgradeable_init();

    require(initialOwner != address(0), "NFT: invalid owner");

    owner = initialOwner;
    operators[initialOwner] = true;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @notice Update operator status
   */
  function setOperator(address operator, bool status) external onlyOwner {
    operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  /**
   * @notice Mint NFT with backend signature
   */
  function mintWithSignature(
    uint256 topicId,
    bytes32 topicHash,
    bytes32 curatedHash,
    uint256 nonce,
    bytes calldata signature
  ) external nonReentrant returns (uint256 tokenId) {
    require(!topicMinted[topicId], "NFT: already minted");
    require(nonce == mintNonce, "NFT: invalid nonce");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(MINT_TYPEHASH, topicId, topicHash, curatedHash, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "NFT: invalid signature");

    // Increment nonce
    mintNonce++;

    // Mark as minted
    topicMinted[topicId] = true;

    // Mint NFT
    tokenId = _tokenIdCounter++;
    ownerOf[tokenId] = msg.sender;
    balanceOf[msg.sender]++;

    // Store metadata
    tokenMetadata[tokenId] = NFTMetadata({
      topicId: topicId,
      topicHash: topicHash,
      curatedHash: curatedHash,
      mintedAt: block.timestamp,
      mintedBy: msg.sender
    });

    topicToTokenId[topicId] = tokenId;

    emit NFTMinted(tokenId, topicId, msg.sender, topicHash, curatedHash);
    emit Transfer(address(0), msg.sender, tokenId);
  }

  /**
   * @notice Get NFT metadata
   */
  function getMetadata(
    uint256 tokenId
  ) external view returns (NFTMetadata memory) {
    require(ownerOf[tokenId] != address(0), "NFT: token not found");
    return tokenMetadata[tokenId];
  }

  /**
   * @notice Token URI (on-chain JSON)
   */
  function tokenURI(uint256 tokenId) public view returns (string memory) {
    require(ownerOf[tokenId] != address(0), "NFT: token not found");
    NFTMetadata memory meta = tokenMetadata[tokenId];

    string memory json = string(
      abi.encodePacked(
        '{"name":"Murmur Memory #',
        tokenId.toString(),
        '","description":"A curated memory from Murmur Protocol - Topic ',
        meta.topicId.toString(),
        '","attributes":[{"trait_type":"Topic ID","value":"',
        meta.topicId.toString(),
        '"},{"trait_type":"Version","value":"',
        VERSION,
        '"},{"trait_type":"Minted At","display_type":"date","value":',
        meta.mintedAt.toString(),
        '}],"image":"',
        baseImageURI,
        tokenId.toString(),
        '.png"}'
      )
    );

    return
      string(
        abi.encodePacked(
          "data:application/json;base64,",
          Base64.encode(bytes(json))
        )
      );
  }

  /**
   * @notice Set base image URI
   */
  function setBaseImageURI(string memory newURI) external onlyOwner {
    baseImageURI = newURI;
    emit BaseImageURIUpdated(newURI);
  }

  /**
   * @notice Get EIP-712 domain separator
   */
  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  /**
   * @notice Simple transfer (non-standard, no approvals)
   */
  function transfer(address to, uint256 tokenId) external {
    require(ownerOf[tokenId] == msg.sender, "NFT: not owner");
    require(to != address(0), "NFT: invalid recipient");

    balanceOf[msg.sender]--;
    balanceOf[to]++;
    ownerOf[tokenId] = to;

    emit Transfer(msg.sender, to, tokenId);
  }
}
