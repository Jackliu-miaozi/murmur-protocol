// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibVPStorage } from "../../libraries/LibVPStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VPSettlementFacet
 * @dev VP Token batch settlement functionality (Diamond Facet)
 */
contract VPSettlement {
  using ECDSA for bytes32;

  bytes32 private constant SETTLEMENT_TYPEHASH =
    keccak256("Settlement(address[] users,int256[] deltas,uint256 nonce)");

  bytes32 private constant TYPE_HASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
  bytes32 private constant NAME_HASH = keccak256("MurmurVPToken");
  bytes32 private constant VERSION_HASH = keccak256("3");

  event SettlementExecuted(uint256 indexed nonce, uint256 totalUsers);

  function settleBalances(
    address[] calldata users,
    int256[] calldata deltas,
    uint256 nonce,
    bytes calldata signature
  ) external {
    LibVPStorage.Storage storage s = LibVPStorage.load();

    require(users.length == deltas.length, "VP: length mismatch");
    require(users.length > 0, "VP: empty settlement");
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
      if (deltas[i] < 0) {
        uint256 burnAmount = uint256(-deltas[i]);
        if (s.balances[users[i]] >= burnAmount) {
          s.balances[users[i]] -= burnAmount;
        }
      } else if (deltas[i] > 0) {
        s.balances[users[i]] += uint256(deltas[i]);
      }
    }

    emit SettlementExecuted(nonce, users.length);
  }

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
}
