// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VPStakingFacet
 * @dev VP Token staking functionality (Diamond Facet)
 */
contract VPStaking {
  using SafeERC20 for IERC20;

  uint256 public constant K = 100;
  uint256 private constant PRECISION = 1e18;

  event VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount);

  function initialize(address _vdotToken, address _owner) external {
    LibVPStorage.Storage storage s = LibVPStorage.load();
    require(!s.initialized, "VP: already initialized");
    s.initialized = true;
    s.vdotToken = IERC20(_vdotToken);
    s.owner = _owner;
    s.operators[_owner] = true;
  }

  function stakeVdot(uint256 amount) external returns (uint256 vpAmount) {
    require(amount > 0, "VP: amount must be > 0");
    LibVPStorage.Storage storage s = LibVPStorage.load();

    s.vdotToken.safeTransferFrom(msg.sender, address(this), amount);
    vpAmount = calculateVP(amount);

    s.stakedVdot[msg.sender] += amount;
    s.totalStakedVdot += amount;
    s.balances[msg.sender] += vpAmount;

    // Reset emergency withdrawal countdown (user is active)
    s.lastActivityTime[msg.sender] = 0;

    emit VdotStaked(msg.sender, amount, vpAmount);
  }

  function calculateVP(
    uint256 vdotAmount
  ) public pure returns (uint256 vpAmount) {
    if (vdotAmount == 0) return 0;
    uint256 sqrtVdot = sqrt(vdotAmount);
    uint256 sqrtPrecision = sqrt(PRECISION);
    vpAmount = sqrtVdot * K * sqrtPrecision;
  }

  function sqrt(uint256 x) internal pure returns (uint256 y) {
    if (x == 0) return 0;
    uint256 z = (x + 1) / 2;
    y = x;
    while (z < y) {
      y = z;
      z = (x / z + z) / 2;
    }
  }

  function balanceOf(address user) external view returns (uint256) {
    return LibVPStorage.load().balances[user];
  }

  function stakedVdot(address user) external view returns (uint256) {
    return LibVPStorage.load().stakedVdot[user];
  }

  function totalStakedVdot() external view returns (uint256) {
    return LibVPStorage.load().totalStakedVdot;
  }
}
