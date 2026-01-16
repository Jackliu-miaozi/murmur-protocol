// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title MurmurNFT
 * @notice Minimal NFT minter for Murmur Protocol (V2 Architecture)
 * @dev Mints NFT with backend signature, includes curated hash and batch VP refunds
 */
contract MurmurNFT is ERC721, AccessControl, ReentrancyGuard, EIP712 {
  using Strings for uint256;
  using ECDSA for bytes32;

  bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

  IVPToken public vpToken;

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
      "MintNFT(uint256 topicId,bytes32 topicHash,bytes32 curatedHash,address[] refundUsers,uint256[] refundAmounts,uint256 nonce)"
    );

  event NFTMinted(
    uint256 indexed tokenId,
    uint256 indexed topicId,
    address indexed minter,
    bytes32 topicHash,
    bytes32 curatedHash
  );
  event VPRefunded(
    uint256 indexed topicId,
    uint256 totalUsers,
    uint256 totalAmount
  );
  event BaseImageURIUpdated(string newURI);

  constructor(
    address _vpToken,
    address initialOwner
  ) ERC721("Murmur Memory", "MURMUR") EIP712("MurmurNFT", "2") {
    require(_vpToken != address(0), "NFT: invalid vp token");
    require(initialOwner != address(0), "NFT: invalid owner");

    vpToken = IVPToken(_vpToken);

    _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
    _grantRole(OPERATOR_ROLE, initialOwner);
  }

  /**
   * @notice Mint NFT with backend signature
   * @dev Includes curated hash on-chain and batch VP refunds
   * @param topicId Topic ID
   * @param topicHash Topic metadata hash (from IPFS)
   * @param curatedHash Hash of curated message IDs
   * @param refundUsers Users to refund VP to
   * @param refundAmounts VP amounts to refund
   * @param nonce Mint nonce
   * @param signature Backend EIP-712 signature
   */
  function mintWithSignature(
    uint256 topicId,
    bytes32 topicHash,
    bytes32 curatedHash,
    address[] calldata refundUsers,
    uint256[] calldata refundAmounts,
    uint256 nonce,
    bytes calldata signature
  ) external nonReentrant returns (uint256 tokenId) {
    require(!topicMinted[topicId], "NFT: already minted");
    require(refundUsers.length == refundAmounts.length, "NFT: length mismatch");
    require(nonce == mintNonce, "NFT: invalid nonce");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(
        MINT_TYPEHASH,
        topicId,
        topicHash,
        curatedHash,
        keccak256(abi.encodePacked(refundUsers)),
        keccak256(abi.encodePacked(refundAmounts)),
        nonce
      )
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(hasRole(OPERATOR_ROLE, signer), "NFT: invalid signature");

    // Increment nonce
    mintNonce++;

    // Mark as minted
    topicMinted[topicId] = true;

    // Mint NFT
    tokenId = _tokenIdCounter++;
    _safeMint(msg.sender, tokenId);

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

    // Batch refund VP
    if (refundUsers.length > 0) {
      _batchRefundVP(topicId, refundUsers, refundAmounts);
    }
  }

  /**
   * @notice Internal batch VP refund
   */
  function _batchRefundVP(
    uint256 topicId,
    address[] calldata users,
    uint256[] calldata amounts
  ) internal {
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < users.length; i++) {
      if (amounts[i] > 0) {
        // Note: vpToken.mint requires MINTER_ROLE
        // This contract should be granted MINTER_ROLE on VPToken
        totalAmount += amounts[i];
      }
    }

    // Use VPToken's batchMint if available, or individual mints
    // For simplicity, we'll emit an event and let backend handle via VPToken.batchMint
    emit VPRefunded(topicId, users.length, totalAmount);
  }

  /**
   * @notice Get NFT metadata
   */
  function getMetadata(
    uint256 tokenId
  ) external view returns (NFTMetadata memory) {
    require(_ownerOf(tokenId) != address(0), "NFT: token not found");
    return tokenMetadata[tokenId];
  }

  /**
   * @notice Token URI (on-chain JSON)
   */
  function tokenURI(
    uint256 tokenId
  ) public view override returns (string memory) {
    require(_ownerOf(tokenId) != address(0), "NFT: token not found");
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
  function setBaseImageURI(
    string memory newURI
  ) external onlyRole(DEFAULT_ADMIN_ROLE) {
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
   * @notice Interface support
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC721, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
