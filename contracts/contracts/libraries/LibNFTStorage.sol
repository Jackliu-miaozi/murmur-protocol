// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LibNFTStorage
 * @dev Diamond Storage for NFT facets
 */
library LibNFTStorage {
  bytes32 constant NFT_STORAGE_POSITION = keccak256("murmur.nft.storage");

  struct Storage {
    address owner;
    mapping(address => bool) operators;
    uint256 tokenIdCounter;
    mapping(uint256 => bytes32) tokenIPFS;
    mapping(uint256 => uint256) tokenTopic;
    mapping(uint256 => bool) topicMinted;
    mapping(uint256 => address) ownerOf;
    mapping(address => uint256) balanceOf;
    uint256 mintNonce;
    bool initialized;
    address feeRecipient; // Address to receive minting fees
    // ERC-721 Approval mappings
    mapping(uint256 => address) tokenApprovals; // tokenId => approved address
    mapping(address => mapping(address => bool)) operatorApprovals; // owner => operator => approved
    // Two-step ownership transfer
    address pendingOwner;
    // Reserved storage gap for future upgrades
    uint256[47] __gap;
  }

  function load() internal pure returns (Storage storage s) {
    bytes32 position = NFT_STORAGE_POSITION;
    assembly {
      s.slot := position
    }
  }
}
