// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title MurmurNFTUltra
 * @notice Ultra-minimal NFT - Proof of participation with IPFS metadata
 * @dev Removes on-chain JSON generation, stores only IPFS hash
 */
contract MurmurNFTUltra is
  Initializable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable,
  UUPSUpgradeable
{
  using ECDSA for bytes32;

  address public owner;
  mapping(address => bool) public operators;

  uint256 private _tokenIdCounter;

  // Simplified: Only store IPFS hash, not full metadata
  mapping(uint256 => bytes32) public tokenIPFS; // tokenId => IPFS hash
  mapping(uint256 => uint256) public tokenTopic; // tokenId => topicId
  mapping(uint256 => bool) public topicMinted;

  mapping(uint256 => address) public ownerOf;
  mapping(address => uint256) public balanceOf;

  uint256 public mintNonce;

  bytes32 private constant MINT_TYPEHASH =
    keccak256("MintNFT(uint256 topicId,bytes32 ipfsHash,uint256 nonce)");

  event NFTMinted(
    uint256 indexed tokenId,
    uint256 indexed topicId,
    address indexed minter,
    bytes32 ipfsHash
  );
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
    __EIP712_init("MurmurNFT", "3");
    __UUPSUpgradeable_init();

    require(initialOwner != address(0), "NFT: invalid owner");
    owner = initialOwner;
    operators[initialOwner] = true;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  function setOperator(address operator, bool status) external onlyOwner {
    operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  /**
   * @notice Mint NFT with IPFS metadata hash
   * @dev Backend uploads metadata to IPFS, signs the hash
   */
  function mintWithSignature(
    uint256 topicId,
    bytes32 ipfsHash,
    uint256 nonce,
    bytes calldata signature
  ) external nonReentrant returns (uint256 tokenId) {
    require(!topicMinted[topicId], "NFT: already minted");
    require(nonce == mintNonce, "NFT: invalid nonce");

    bytes32 structHash = keccak256(
      abi.encode(MINT_TYPEHASH, topicId, ipfsHash, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "NFT: invalid signature");

    mintNonce++;
    topicMinted[topicId] = true;

    tokenId = _tokenIdCounter++;
    ownerOf[tokenId] = msg.sender;
    balanceOf[msg.sender]++;

    tokenIPFS[tokenId] = ipfsHash;
    tokenTopic[tokenId] = topicId;

    emit NFTMinted(tokenId, topicId, msg.sender, ipfsHash);
    emit Transfer(address(0), msg.sender, tokenId);
  }

  /**
   * @notice Get token URI (IPFS)
   * @dev Returns IPFS gateway URL
   */
  function tokenURI(uint256 tokenId) external view returns (string memory) {
    require(ownerOf[tokenId] != address(0), "NFT: token not found");
    return
      string(abi.encodePacked("ipfs://", bytes32ToHex(tokenIPFS[tokenId])));
  }

  /**
   * @notice Helper: Convert bytes32 to hex string
   */
  function bytes32ToHex(bytes32 data) internal pure returns (string memory) {
    bytes memory hexChars = "0123456789abcdef";
    bytes memory str = new bytes(64);
    for (uint256 i = 0; i < 32; i++) {
      str[i * 2] = hexChars[uint8(data[i] >> 4)];
      str[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
    }
    return string(str);
  }

  /**
   * @notice Simple transfer
   */
  function transfer(address to, uint256 tokenId) external {
    require(ownerOf[tokenId] == msg.sender, "NFT: not owner");
    require(to != address(0), "NFT: invalid recipient");

    balanceOf[msg.sender]--;
    balanceOf[to]++;
    ownerOf[tokenId] = to;

    emit Transfer(msg.sender, to, tokenId);
  }

  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }
}
