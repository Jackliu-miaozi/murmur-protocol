// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VDOTToken
 * @notice Minimal ERC20 implementation for vDOT (test token)
 * @dev Simplified to reduce bytecode size
 */
contract VDOTToken {
  string public constant name = "Voucher DOT";
  string public constant symbol = "vDOT";
  uint8 public constant decimals = 18;

  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  address public owner;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
  }

  constructor(address _owner) {
    owner = _owner;
    // Mint initial supply to owner (1 million tokens)
    uint256 initialSupply = 1_000_000 * 10 ** 18;
    balanceOf[_owner] = initialSupply;
    totalSupply = initialSupply;
    emit Transfer(address(0), _owner, initialSupply);
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    return _transfer(msg.sender, to, amount);
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool) {
    uint256 allowed = allowance[from][msg.sender];
    if (allowed != type(uint256).max) {
      require(allowed >= amount, "Allowance exceeded");
      allowance[from][msg.sender] = allowed - amount;
    }
    return _transfer(from, to, amount);
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    require(to != address(0), "Transfer to zero");
    require(balanceOf[from] >= amount, "Insufficient balance");

    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    emit Transfer(from, to, amount);
    return true;
  }

  function mint(address to, uint256 amount) external onlyOwner {
    totalSupply += amount;
    balanceOf[to] += amount;
    emit Transfer(address(0), to, amount);
  }
}
