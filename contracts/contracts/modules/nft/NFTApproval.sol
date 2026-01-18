// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";

/**
 * @title NFTApprovalFacet
 * @notice ERC-721 approval functionality (Diamond Facet)
 * @dev Implements approve, setApprovalForAll, and related query functions
 */
contract NFTApproval {
  event Approval(
    address indexed owner,
    address indexed approved,
    uint256 indexed tokenId
  );
  event ApprovalForAll(
    address indexed owner,
    address indexed operator,
    bool approved
  );

  /**
   * @notice Approve an address to transfer a specific token
   * @param to Address to approve
   * @param tokenId Token ID to approve
   */
  function approve(address to, uint256 tokenId) external {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    address tokenOwner = s.ownerOf[tokenId];

    require(tokenOwner != address(0), "NFT: token not found");
    require(
      msg.sender == tokenOwner || s.operatorApprovals[tokenOwner][msg.sender],
      "NFT: not owner or approved"
    );
    require(to != tokenOwner, "NFT: approval to owner");

    s.tokenApprovals[tokenId] = to;
    emit Approval(tokenOwner, to, tokenId);
  }

  /**
   * @notice Get the approved address for a token
   * @param tokenId Token ID to query
   * @return Approved address, or zero if none
   */
  function getApproved(uint256 tokenId) external view returns (address) {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(s.ownerOf[tokenId] != address(0), "NFT: token not found");
    return s.tokenApprovals[tokenId];
  }

  /**
   * @notice Set or revoke approval for all tokens
   * @param operator Address to set approval for
   * @param approved True to approve, false to revoke
   */
  function setApprovalForAll(address operator, bool approved) external {
    require(operator != msg.sender, "NFT: approve to caller");
    LibNFTStorage.load().operatorApprovals[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  /**
   * @notice Check if an operator is approved for all tokens of an owner
   * @param owner_ Token owner address
   * @param operator Operator address
   * @return True if approved for all
   */
  function isApprovedForAll(
    address owner_,
    address operator
  ) external view returns (bool) {
    return LibNFTStorage.load().operatorApprovals[owner_][operator];
  }

  /**
   * @notice Check if spender is approved or owner of token
   * @param spender Address to check
   * @param tokenId Token ID
   * @return True if spender can transfer the token
   */
  function isApprovedOrOwner(
    address spender,
    uint256 tokenId
  ) external view returns (bool) {
    return _isApprovedOrOwner(spender, tokenId);
  }

  function _isApprovedOrOwner(
    address spender,
    uint256 tokenId
  ) internal view returns (bool) {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    address tokenOwner = s.ownerOf[tokenId];
    if (tokenOwner == address(0)) return false;

    return (spender == tokenOwner ||
      s.tokenApprovals[tokenId] == spender ||
      s.operatorApprovals[tokenOwner][spender]);
  }
}
