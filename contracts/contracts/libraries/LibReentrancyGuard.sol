// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LibReentrancyGuard
 * @notice Diamond Storage for reentrancy protection
 * @dev Provides reentrancy guard using Diamond Storage pattern
 */
library LibReentrancyGuard {
  bytes32 constant REENTRANCY_STORAGE_POSITION =
    keccak256("murmur.reentrancy.storage");

  uint256 private constant NOT_ENTERED = 1;
  uint256 private constant ENTERED = 2;

  struct Storage {
    uint256 status;
  }

  function load() internal pure returns (Storage storage s) {
    bytes32 position = REENTRANCY_STORAGE_POSITION;
    assembly {
      s.slot := position
    }
  }

  function initializeIfNeeded() internal {
    Storage storage s = load();
    if (s.status == 0) {
      s.status = NOT_ENTERED;
    }
  }

  function enter() internal {
    Storage storage s = load();
    // Initialize if needed (first call)
    if (s.status == 0) {
      s.status = NOT_ENTERED;
    }
    require(s.status != ENTERED, "ReentrancyGuard: reentrant call");
    s.status = ENTERED;
  }

  function exit() internal {
    load().status = NOT_ENTERED;
  }
}
