// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MurmurProtocol
 * @notice Simple protocol registry - immutable address book for Murmur Protocol
 * @dev Stores the official contract addresses for frontend/backend discovery
 */
contract MurmurProtocol {
  address public immutable vpDiamond;
  address public immutable nftDiamond;
  address public immutable vdotToken;

  string public constant VERSION = "3.0.0";

  event ProtocolDeployed(
    address indexed vpDiamond,
    address indexed nftDiamond,
    address indexed vdotToken
  );

  constructor(address _vpDiamond, address _nftDiamond, address _vdotToken) {
    require(_vpDiamond != address(0), "Invalid VP Diamond");
    require(_nftDiamond != address(0), "Invalid NFT Diamond");
    require(_vdotToken != address(0), "Invalid vDOT Token");

    vpDiamond = _vpDiamond;
    nftDiamond = _nftDiamond;
    vdotToken = _vdotToken;

    emit ProtocolDeployed(_vpDiamond, _nftDiamond, _vdotToken);
  }

  /**
   * @notice Get all protocol addresses in one call
   */
  function getAddresses()
    external
    view
    returns (address vpDiamond_, address nftDiamond_, address vdotToken_)
  {
    return (vpDiamond, nftDiamond, vdotToken);
  }
}
