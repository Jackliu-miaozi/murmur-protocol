// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RouterProxy
 * @notice Lightweight proxy that routes calls to multiple implementation contracts
 * @dev Replaces Diamond pattern with simpler, smaller implementation (~10KB)
 *      Includes two-step ownership transfer for security
 */
contract RouterProxy {
  address public owner;
  address public pendingOwner;

  // Function selector => implementation address
  mapping(bytes4 => address) public routes;

  event RouteUpdated(
    bytes4 indexed selector,
    address indexed oldImplementation,
    address indexed newImplementation
  );
  event OwnershipTransferStarted(
    address indexed currentOwner,
    address indexed pendingOwner
  );
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );

  modifier onlyOwner() {
    require(msg.sender == owner, "RouterProxy: not owner");
    _;
  }

  constructor(address _owner) {
    require(_owner != address(0), "RouterProxy: zero address");
    owner = _owner;
  }

  // ============ Route Management ============

  /**
   * @notice Set route for a single function selector
   * @param selector Function selector (4 bytes)
   * @param implementation Address of the implementation contract
   */
  function setRoute(
    bytes4 selector,
    address implementation
  ) external onlyOwner {
    address oldImpl = routes[selector];
    routes[selector] = implementation;
    emit RouteUpdated(selector, oldImpl, implementation);
  }

  /**
   * @notice Set routes for multiple function selectors (batch)
   * @param selectors Array of function selectors
   * @param implementation Address of the implementation contract
   */
  function setRoutes(
    bytes4[] calldata selectors,
    address implementation
  ) external onlyOwner {
    for (uint256 i = 0; i < selectors.length; i++) {
      address oldImpl = routes[selectors[i]];
      routes[selectors[i]] = implementation;
      emit RouteUpdated(selectors[i], oldImpl, implementation);
    }
  }

  /**
   * @notice Remove route for a function selector
   * @param selector Function selector to remove
   */
  function removeRoute(bytes4 selector) external onlyOwner {
    address oldImpl = routes[selector];
    delete routes[selector];
    emit RouteUpdated(selector, oldImpl, address(0));
  }

  /**
   * @notice Get implementation for a function selector
   */
  function getRoute(bytes4 selector) external view returns (address) {
    return routes[selector];
  }

  // ============ Ownership (Two-Step Transfer) ============

  /**
   * @notice Start ownership transfer (step 1)
   * @param newOwner Address of the new owner
   */
  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "RouterProxy: zero address");
    pendingOwner = newOwner;
    emit OwnershipTransferStarted(owner, newOwner);
  }

  /**
   * @notice Accept ownership transfer (step 2)
   * @dev Only the pending owner can call this
   */
  function acceptOwnership() external {
    require(msg.sender == pendingOwner, "RouterProxy: not pending owner");
    address oldOwner = owner;
    owner = msg.sender;
    pendingOwner = address(0);
    emit OwnershipTransferred(oldOwner, msg.sender);
  }

  /**
   * @notice Cancel pending ownership transfer
   */
  function cancelOwnershipTransfer() external onlyOwner {
    pendingOwner = address(0);
  }

  // ============ Fallback ============

  /**
   * @notice Fallback: route call to appropriate implementation
   */
  fallback() external payable {
    address impl = routes[msg.sig];
    require(impl != address(0), "RouterProxy: no route");

    assembly {
      calldatacopy(0, 0, calldatasize())
      let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
      returndatacopy(0, 0, returndatasize())
      switch result
      case 0 {
        revert(0, returndatasize())
      }
      default {
        return(0, returndatasize())
      }
    }
  }

  receive() external payable {}
}
