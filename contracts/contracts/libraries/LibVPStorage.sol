// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LibVPStorage
 * @dev Diamond Storage for VP Token facets
 */
library LibVPStorage {
  bytes32 constant VP_STORAGE_POSITION = keccak256("murmur.vp.storage");

  struct Storage {
    address owner;
    mapping(address => bool) operators;
    IERC20 vdotToken;
    mapping(address => uint256) stakedVdot;
    uint256 totalStakedVdot;
    mapping(address => uint256) balances;
    mapping(address => uint256) userNonce;
    uint256 settlementNonce;
    bool initialized;
    // Emergency withdrawal: track last activity time per user
    mapping(address => uint256) lastActivityTime;
    uint256 emergencyDelay; // Default: 7 days
    // Two-step ownership transfer
    address pendingOwner;
    // Reserved storage gap for future upgrades
    uint256[48] __gap;
  }

  function load() internal pure returns (Storage storage s) {
    bytes32 position = VP_STORAGE_POSITION;
    assembly {
      s.slot := position
    }
  }
}
