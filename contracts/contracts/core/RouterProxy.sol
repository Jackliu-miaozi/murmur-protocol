// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RouterProxy
 * @notice Lightweight proxy that routes calls to multiple implementation contracts
 * @dev Replaces Diamond pattern with simpler, smaller implementation (~10KB)
 */
contract RouterProxy {
  address public owner;

  // Function selector => implementation address
  mapping(bytes4 => address) public routes;

  event RouteUpdated(bytes4 indexed selector, address indexed implementation);
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

  /**
   * @notice Set route for a single function selector
   */
  function setRoute(
    bytes4 selector,
    address implementation
  ) external onlyOwner {
    routes[selector] = implementation;
    emit RouteUpdated(selector, implementation);
  }

  /**
   * @notice Set routes for multiple function selectors (batch)
   */
  function setRoutes(
    bytes4[] calldata selectors,
    address implementation
  ) external onlyOwner {
    for (uint256 i = 0; i < selectors.length; i++) {
      routes[selectors[i]] = implementation;
      emit RouteUpdated(selectors[i], implementation);
    }
  }

  /**
   * @notice Transfer ownership
   */
  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "RouterProxy: zero address");
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  /**
   * @notice Get implementation for a function selector
   */
  function getRoute(bytes4 selector) external view returns (address) {
    return routes[selector];
  }

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
