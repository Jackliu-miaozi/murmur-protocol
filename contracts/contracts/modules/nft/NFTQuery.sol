// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";

/**
 * @title NFTQueryFacet
 * @dev NFT query and transfer functionality (Diamond Facet)
 */
contract NFTQuery {
  event Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId
  );

  function ownerOf(uint256 tokenId) external view returns (address) {
    address owner_ = LibNFTStorage.load().ownerOf[tokenId];
    require(owner_ != address(0), "NFT: token not found");
    return owner_;
  }

  function balanceOf(address owner_) external view returns (uint256) {
    return LibNFTStorage.load().balanceOf[owner_];
  }

  function tokenURI(uint256 tokenId) external view returns (string memory) {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(s.ownerOf[tokenId] != address(0), "NFT: token not found");
    return
      string(abi.encodePacked("ipfs://", _bytes32ToHex(s.tokenIPFS[tokenId])));
  }

  function tokenTopic(uint256 tokenId) external view returns (uint256) {
    return LibNFTStorage.load().tokenTopic[tokenId];
  }

  function tokenIPFS(uint256 tokenId) external view returns (bytes32) {
    return LibNFTStorage.load().tokenIPFS[tokenId];
  }

  function transfer(address to, uint256 tokenId) external {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(s.ownerOf[tokenId] == msg.sender, "NFT: not owner");
    require(to != address(0), "NFT: invalid recipient");

    s.balanceOf[msg.sender]--;
    s.balanceOf[to]++;
    s.ownerOf[tokenId] = to;

    emit Transfer(msg.sender, to, tokenId);
  }

  function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
    bytes memory hexChars = "0123456789abcdef";
    bytes memory str = new bytes(64);
    for (uint256 i = 0; i < 32; i++) {
      str[i * 2] = hexChars[uint8(data[i] >> 4)];
      str[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
    }
    return string(str);
  }
}
