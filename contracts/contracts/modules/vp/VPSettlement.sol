// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import { LibPausable } from "../../libraries/LibPausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VPSettlementFacet
 * @notice VP Token batch settlement functionality (Diamond Facet)
 * @dev Allows operators to batch update VP balances with signature verification
 */
contract VPSettlement {
  using ECDSA for bytes32;

  /// @notice Maximum users per settlement batch (gas safety)
  uint256 public constant MAX_SETTLEMENT_BATCH = 200;

  bytes32 private constant SETTLEMENT_TYPEHASH =
    keccak256("Settlement(address[] users,int256[] deltas,uint256 nonce)");

  bytes32 private constant TYPE_HASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
  bytes32 private constant NAME_HASH = keccak256("MurmurVPToken");
  bytes32 private constant VERSION_HASH = keccak256("3");

  /// @notice Emitted for each user's balance change (for The Graph indexing)
  event VPBalanceChanged(
    address indexed user,
    int256 delta,
    uint256 newBalance,
    uint256 indexed settlementNonce
  );

  /// @notice Emitted when a settlement batch is executed
  event SettlementExecuted(uint256 indexed nonce, uint256 totalUsers);

  /**
   * @notice Batch update VP balances with operator signature
   * @param users Array of user addresses
   * @param deltas Array of balance changes (positive = mint, negative = burn)
   * @param nonce Settlement nonce (must match current)
   * @param signature Operator's EIP-712 signature
   */
  function settleBalances(
    address[] calldata users,
    int256[] calldata deltas,
    uint256 nonce,
    bytes calldata signature
  ) external {
    LibPausable.requireNotPaused();
    LibVPStorage.Storage storage s = LibVPStorage.load();

    require(users.length == deltas.length, "VP: length mismatch");
    require(users.length > 0, "VP: empty settlement");
    require(users.length <= MAX_SETTLEMENT_BATCH, "VP: batch too large");
    require(nonce == s.settlementNonce, "VP: invalid nonce");

    bytes32 structHash = keccak256(
      abi.encode(
        SETTLEMENT_TYPEHASH,
        keccak256(abi.encodePacked(users)),
        keccak256(abi.encodePacked(deltas)),
        nonce
      )
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(s.operators[signer], "VP: invalid signature");

    s.settlementNonce++;

    for (uint256 i = 0; i < users.length; i++) {
      address user = users[i];
      require(user != address(0), "VP: invalid user address");
      int256 delta = deltas[i];

      if (delta < 0) {
        uint256 burnAmount = uint256(-delta);
        if (s.balances[user] >= burnAmount) {
          s.balances[user] -= burnAmount;
        } else {
          // If insufficient balance, set to 0 (don't revert)
          s.balances[user] = 0;
        }
      } else if (delta > 0) {
        s.balances[user] += uint256(delta);
      }

      // Emit per-user event for indexing
      emit VPBalanceChanged(user, delta, s.balances[user], nonce);
    }

    emit SettlementExecuted(nonce, users.length);
  }

  /**
   * @notice Get current settlement nonce
   */
  function settlementNonce() external view returns (uint256) {
    return LibVPStorage.load().settlementNonce;
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

  /**
   * @notice Get the domain separator for EIP-712
   */
  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }
}
