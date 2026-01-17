// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VPWithdrawFacet
 * @dev VP Token withdrawal functionality (Diamond Facet)
 */
contract VPWithdraw {
  using SafeERC20 for IERC20;
  using ECDSA for bytes32;

  bytes32 private constant WITHDRAW_TYPEHASH =
    keccak256(
      "Withdraw(address user,uint256 vpBurnAmount,uint256 vdotReturn,uint256 nonce)"
    );

  // EIP-712 domain separator components
  bytes32 private constant TYPE_HASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
  bytes32 private constant NAME_HASH = keccak256("MurmurVPToken");
  bytes32 private constant VERSION_HASH = keccak256("3");

  event VdotWithdrawn(
    address indexed user,
    uint256 vdotAmount,
    uint256 vpBurned
  );

  function withdrawWithVP(
    uint256 vpBurnAmount,
    uint256 vdotReturn,
    uint256 nonce,
    bytes calldata signature
  ) external {
    LibVPStorage.Storage storage s = LibVPStorage.load();

    require(vpBurnAmount > 0, "VP: burn amount > 0");
    require(vdotReturn > 0, "VP: return amount > 0");
    require(s.stakedVdot[msg.sender] >= vdotReturn, "VP: insufficient staked");
    require(s.balances[msg.sender] >= vpBurnAmount, "VP: insufficient VP");
    require(nonce == s.userNonce[msg.sender], "VP: invalid nonce");

    bytes32 structHash = keccak256(
      abi.encode(WITHDRAW_TYPEHASH, msg.sender, vpBurnAmount, vdotReturn, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(s.operators[signer], "VP: invalid signature");

    s.userNonce[msg.sender]++;
    s.stakedVdot[msg.sender] -= vdotReturn;
    s.totalStakedVdot -= vdotReturn;
    s.balances[msg.sender] -= vpBurnAmount;

    // Reset emergency withdrawal countdown (backend is responsive)
    s.lastActivityTime[msg.sender] = 0;

    s.vdotToken.safeTransfer(msg.sender, vdotReturn);
    emit VdotWithdrawn(msg.sender, vdotReturn, vpBurnAmount);
  }

  function userNonce(address user) external view returns (uint256) {
    return LibVPStorage.load().userNonce[user];
  }

  function _hashTypedDataV4(
    bytes32 structHash
  ) internal view returns (bytes32) {
    return MessageHashUtils.toTypedDataHash(_domainSeparatorV4(), structHash);
  }

  function _domainSeparatorV4() internal view returns (bytes32) {
    return
      keccak256(
        abi.encode(
          TYPE_HASH,
          NAME_HASH,
          VERSION_HASH,
          block.chainid,
          address(this)
        )
      );
  }

  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  /**
   * @notice Request emergency withdrawal (starts cooldown)
   * @dev User must wait emergencyDelay (7 days) before withdrawing
   */
  function requestEmergencyWithdraw() external {
    LibVPStorage.Storage storage s = LibVPStorage.load();
    require(s.stakedVdot[msg.sender] > 0, "VP: no stake");
    s.lastActivityTime[msg.sender] = block.timestamp;
  }

  /**
   * @notice Emergency withdraw after cooldown period
   * @dev Can only withdraw if no backend activity for emergencyDelay period
   */
  function emergencyWithdraw() external {
    LibVPStorage.Storage storage s = LibVPStorage.load();

    uint256 lastActivity = s.lastActivityTime[msg.sender];
    require(lastActivity > 0, "VP: request first");

    uint256 delay = s.emergencyDelay > 0 ? s.emergencyDelay : 7 days;
    require(block.timestamp >= lastActivity + delay, "VP: cooldown not passed");

    uint256 stakedAmount = s.stakedVdot[msg.sender];
    require(stakedAmount > 0, "VP: no stake");

    // Clear user state
    s.stakedVdot[msg.sender] = 0;
    s.totalStakedVdot -= stakedAmount;
    s.balances[msg.sender] = 0;
    s.lastActivityTime[msg.sender] = 0;

    // Return all staked vDOT
    s.vdotToken.safeTransfer(msg.sender, stakedAmount);

    emit EmergencyWithdrawn(msg.sender, stakedAmount);
  }

  /**
   * @notice Get remaining cooldown time for emergency withdrawal
   */
  function emergencyCooldownRemaining(
    address user
  ) external view returns (uint256) {
    LibVPStorage.Storage storage s = LibVPStorage.load();
    uint256 lastActivity = s.lastActivityTime[user];
    if (lastActivity == 0) return type(uint256).max; // Not requested

    uint256 delay = s.emergencyDelay > 0 ? s.emergencyDelay : 7 days;
    uint256 unlockTime = lastActivity + delay;

    if (block.timestamp >= unlockTime) return 0;
    return unlockTime - block.timestamp;
  }

  event EmergencyWithdrawn(address indexed user, uint256 vdotAmount);
}
