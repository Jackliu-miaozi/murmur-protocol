// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LibPausable
 * @notice Diamond Storage for protocol pause state
 * @dev Provides pausable functionality using Diamond Storage pattern
 */
library LibPausable {
  bytes32 constant PAUSABLE_STORAGE_POSITION =
    keccak256("murmur.pausable.storage");

  struct Storage {
    bool paused;
  }

  event Paused(address indexed account);
  event Unpaused(address indexed account);

  function load() internal pure returns (Storage storage s) {
    bytes32 position = PAUSABLE_STORAGE_POSITION;
    assembly {
      s.slot := position
    }
  }

  function pause() internal {
    Storage storage s = load();
    require(!s.paused, "Pausable: already paused");
    s.paused = true;
    emit Paused(msg.sender);
  }

  function unpause() internal {
    Storage storage s = load();
    require(s.paused, "Pausable: not paused");
    s.paused = false;
    emit Unpaused(msg.sender);
  }

  function isPaused() internal view returns (bool) {
    return load().paused;
  }

  function requireNotPaused() internal view {
    require(!load().paused, "Pausable: paused");
  }
}
