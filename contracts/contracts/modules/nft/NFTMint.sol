// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title NFTMintFacet
 * @dev NFT minting functionality (Diamond Facet)
 */
contract NFTMint {
  using ECDSA for bytes32;

  /// @notice Minting fee: 0.1 DOT
  uint256 public constant MINT_FEE = 0.1 ether;

  bytes32 private constant MINT_TYPEHASH =
    keccak256("MintNFT(uint256 topicId,bytes32 ipfsHash,uint256 nonce)");

  bytes32 private constant TYPE_HASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
  bytes32 private constant NAME_HASH = keccak256("MurmurNFT");
  bytes32 private constant VERSION_HASH = keccak256("3");

  event NFTMinted(
    uint256 indexed tokenId,
    uint256 indexed topicId,
    address indexed minter,
    bytes32 ipfsHash
  );
  event Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId
  );
  event MintFeeCollected(
    address indexed minter,
    address indexed recipient,
    uint256 amount
  );

  function initialize(address _owner) external {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(!s.initialized, "NFT: already initialized");
    s.initialized = true;
    s.owner = _owner;
    s.operators[_owner] = true;
    s.feeRecipient = _owner; // Default fee recipient is owner
  }

  function mintWithSignature(
    uint256 topicId,
    bytes32 ipfsHash,
    uint256 nonce,
    bytes calldata signature
  ) external payable returns (uint256 tokenId) {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();

    require(msg.value >= MINT_FEE, "NFT: insufficient fee");
    require(!s.topicMinted[topicId], "NFT: already minted");
    require(nonce == s.mintNonce, "NFT: invalid nonce");

    bytes32 structHash = keccak256(
      abi.encode(MINT_TYPEHASH, topicId, ipfsHash, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(s.operators[signer], "NFT: invalid signature");

    // Collect minting fee
    address feeRecipient = s.feeRecipient != address(0)
      ? s.feeRecipient
      : s.owner;
    (bool success, ) = feeRecipient.call{ value: MINT_FEE }("");
    require(success, "NFT: fee transfer failed");
    emit MintFeeCollected(msg.sender, feeRecipient, MINT_FEE);

    // Refund excess payment
    if (msg.value > MINT_FEE) {
      (success, ) = msg.sender.call{ value: msg.value - MINT_FEE }("");
      require(success, "NFT: refund failed");
    }

    s.mintNonce++;
    s.topicMinted[topicId] = true;

    tokenId = s.tokenIdCounter++;
    s.ownerOf[tokenId] = msg.sender;
    s.balanceOf[msg.sender]++;
    s.tokenIPFS[tokenId] = ipfsHash;
    s.tokenTopic[tokenId] = topicId;

    emit NFTMinted(tokenId, topicId, msg.sender, ipfsHash);
    emit Transfer(address(0), msg.sender, tokenId);
  }

  function mintNonce() external view returns (uint256) {
    return LibNFTStorage.load().mintNonce;
  }

  function topicMinted(uint256 topicId) external view returns (bool) {
    return LibNFTStorage.load().topicMinted[topicId];
  }

  function _hashTypedDataV4(
    bytes32 structHash
  ) internal view returns (bytes32) {
    return MessageHashUtils.toTypedDataHash(_domainSeparatorV4(), structHash);
  }

  function _domainSeparatorV4() internal view returns (bytes32) {
    return
      keccak256(
        abi.encode(
          TYPE_HASH,
          NAME_HASH,
          VERSION_HASH,
          block.chainid,
          address(this)
        )
      );
  }

  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }
}
