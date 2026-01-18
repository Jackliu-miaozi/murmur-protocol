// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibNFTStorage } from "../../libraries/LibNFTStorage.sol";
import { LibPausable } from "../../libraries/LibPausable.sol";

/**
 * @title NFTQueryFacet
 * @notice NFT query, transfer, and ERC-721 compliance functionality (Diamond Facet)
 * @dev Implements full ERC-721 standard including safeTransferFrom and ERC-165
 */
contract NFTQuery {
  /// @dev ERC-721 interface ID
  bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
  /// @dev ERC-721 Metadata interface ID
  bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
  /// @dev ERC-165 interface ID
  bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;

  event Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId
  );
  event Approval(
    address indexed owner,
    address indexed approved,
    uint256 indexed tokenId
  );

  // ============ ERC-165 ============

  /**
   * @notice Check if contract supports an interface
   * @param interfaceId Interface identifier
   * @return True if supported
   */
  function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
    return
      interfaceId == INTERFACE_ID_ERC721 ||
      interfaceId == INTERFACE_ID_ERC721_METADATA ||
      interfaceId == INTERFACE_ID_ERC165;
  }

  // ============ ERC-721 Query ============

  /**
   * @notice Get owner of a token
   * @param tokenId Token ID to query
   * @return Owner address
   */
  function ownerOf(uint256 tokenId) external view returns (address) {
    address owner_ = LibNFTStorage.load().ownerOf[tokenId];
    require(owner_ != address(0), "NFT: token not found");
    return owner_;
  }

  /**
   * @notice Get token balance of an address
   * @param owner_ Address to query
   * @return Number of tokens owned
   */
  function balanceOf(address owner_) external view returns (uint256) {
    require(owner_ != address(0), "NFT: zero address");
    return LibNFTStorage.load().balanceOf[owner_];
  }

  /**
   * @notice Get token URI (IPFS link)
   * @param tokenId Token ID
   * @return IPFS URI string
   */
  function tokenURI(uint256 tokenId) external view returns (string memory) {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(s.ownerOf[tokenId] != address(0), "NFT: token not found");
    return
      string(abi.encodePacked("ipfs://", _bytes32ToHex(s.tokenIPFS[tokenId])));
  }

  /**
   * @notice Get topic ID associated with a token
   */
  function tokenTopic(uint256 tokenId) external view returns (uint256) {
    return LibNFTStorage.load().tokenTopic[tokenId];
  }

  /**
   * @notice Get IPFS hash of a token
   */
  function tokenIPFS(uint256 tokenId) external view returns (bytes32) {
    return LibNFTStorage.load().tokenIPFS[tokenId];
  }

  // ============ ERC-721 Metadata ============

  /**
   * @notice Get collection name
   */
  function name() external pure returns (string memory) {
    return "Murmur Memory";
  }

  /**
   * @notice Get collection symbol
   */
  function symbol() external pure returns (string memory) {
    return "MURMUR";
  }

  // ============ ERC-721 Transfers ============

  /**
   * @notice Transfer token (simple, msg.sender must be owner)
   * @param to Recipient address
   * @param tokenId Token ID to transfer
   */
  function transfer(address to, uint256 tokenId) external {
    LibPausable.requireNotPaused();
    LibNFTStorage.Storage storage s = LibNFTStorage.load();
    require(s.ownerOf[tokenId] == msg.sender, "NFT: not owner");
    require(to != address(0), "NFT: invalid recipient");

    _transfer(msg.sender, to, tokenId);
  }

  /**
   * @notice Transfer token from one address to another
   * @param from Current owner
   * @param to Recipient
   * @param tokenId Token ID
   */
  function transferFrom(address from, address to, uint256 tokenId) external {
    LibPausable.requireNotPaused();
    require(_isApprovedOrOwner(msg.sender, tokenId), "NFT: not authorized");
    require(to != address(0), "NFT: invalid recipient");

    _transfer(from, to, tokenId);
  }

  /**
   * @notice Safe transfer with receiver check
   * @param from Current owner
   * @param to Recipient
   * @param tokenId Token ID
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external {
    safeTransferFrom(from, to, tokenId, "");
  }

  /**
   * @notice Safe transfer with receiver check and data
   * @param from Current owner
   * @param to Recipient
   * @param tokenId Token ID
   * @param data Additional data to pass to receiver
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) public {
    LibPausable.requireNotPaused();
    require(_isApprovedOrOwner(msg.sender, tokenId), "NFT: not authorized");
    require(to != address(0), "NFT: invalid recipient");

    _transfer(from, to, tokenId);

    if (_isContract(to)) {
      require(
        _checkOnERC721Received(from, to, tokenId, data),
        "NFT: transfer to non-receiver"
      );
    }
  }

  // ============ Internal Functions ============

  function _transfer(address from, address to, uint256 tokenId) internal {
    LibNFTStorage.Storage storage s = LibNFTStorage.load();

    require(s.ownerOf[tokenId] == from, "NFT: not owner");

    // Clear approval
    delete s.tokenApprovals[tokenId];
    emit Approval(from, address(0), tokenId);

    // Update balances
    s.balanceOf[from]--;
    s.balanceOf[to]++;
    s.ownerOf[tokenId] = to;

    emit Transfer(from, to, tokenId);
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

  function _isContract(address account) internal view returns (bool) {
    uint256 size;
    assembly {
      size := extcodesize(account)
    }
    return size > 0;
  }

  function _checkOnERC721Received(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) internal returns (bool) {
    try
      IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data)
    returns (bytes4 retval) {
      return retval == IERC721Receiver.onERC721Received.selector;
    } catch (bytes memory) {
      return false;
    }
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

/**
 * @title IERC721Receiver
 * @dev Interface for any contract that wants to support safeTransfers from ERC721 asset contracts.
 */
interface IERC721Receiver {
  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external returns (bytes4);
}
