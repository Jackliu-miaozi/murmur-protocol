# Murmur Protocol: Known Risks and Limitations

> 📅 Version: 3.0.0  
> 📅 Last Updated: 2026-01-18

This document proactively discloses known risks, trade-offs, and limitations in the Murmur Protocol smart contracts.

---

## 🔴 High Severity Risks

### 1. Centralization Risk: Owner Privileges

**Risk**: The contract owner has significant centralized control.

| Action                      | Impact                                               |
| --------------------------- | ---------------------------------------------------- |
| `pause()`                   | Halt all user operations (except emergency withdraw) |
| `emergencyWithdrawTokens()` | Drain all vDOT from contract                         |
| `setRoute()`                | Deploy malicious implementations                     |
| `setOperator()`             | Grant signing authority to attacker                  |

**Mitigation**:

- ✅ Two-step ownership transfer prevents accidental loss
- ✅ Emergency withdraw for users works even when paused
- 🔲 **Recommended**: Use multi-sig wallet for owner
- 🔲 **Recommended**: Implement timelock for critical operations

---

### 2. Backend Dependency Risk

**Risk**: Normal operations require a responsive backend.

| Scenario                | Impact                            |
| ----------------------- | --------------------------------- |
| Backend offline         | Users cannot withdraw VP normally |
| Signing key compromised | Attacker can drain user VP        |
| Backend bugs            | Incorrect settlement amounts      |

**Mitigation**:

- ✅ Emergency withdrawal available after 7-day cooldown
- ✅ Per-user nonces prevent replay attacks
- 🔲 **Recommendation**: Monitor backend health, implement key rotation

---

## 🟠 Medium Severity Risks

### 3. Gas Exhaustion in Settlement

**Risk**: Large settlement batches may run out of gas.

**Current Safeguard**:

```solidity
uint256 public constant MAX_SETTLEMENT_BATCH = 200;
```

**Residual Risk**:

- 200 users with complex state may still exceed gas limits on some networks
- Failed settlements require retry with smaller batches

**Mitigation**: Backend should monitor gas usage and adjust batch sizes dynamically.

---

### 4. Signature Malleability

**Risk**: ECDSA signatures have inherent malleability (s-value).

**Current Safeguard**: OpenZeppelin's `ECDSA.recover()` enforces low-s values.

**Residual Risk**: None, fully mitigated by OpenZeppelin implementation.

---

### 5. Cross-Function Reentrancy

**Risk**: Non-reentrant functions could be called via other entry points.

**Current Safeguards**:

- ✅ `LibReentrancyGuard` protects all fund-transfer functions
- ✅ All external calls are at the end of functions (CEI pattern)

**Residual Risk**: New implementations must maintain these patterns.

---

## 🟡 Low Severity Risks

### 6. Block Timestamp Manipulation

**Risk**: Validators can manipulate timestamps slightly.

**Usage**: Emergency withdrawal cooldown (7 days).

**Impact**: Attacker could shorten cooldown by ~15 seconds, negligible for 7-day period.

**Mitigation**: Not needed, risk is acceptable.

---

### 7. Front-Running on Initialization

**Risk**: Attacker could front-run `initialize()` on a deployed contract.

**Current Safeguard**:

- Deployment scripts should call `initialize()` in same transaction (if supported)
- Or immediately after deployment

**Residual Risk**: Low, requires specific deployment script patterns.

---

### 8. NFT Metadata Permanence

**Risk**: NFT metadata on IPFS may become unavailable if gateway/pinning fails.

**Current Design**: IPFS hash stored on-chain, retrieval depends on IPFS availability.

**Mitigation**:

- 🔲 **Recommendation**: Use multiple pinning services (Pinata, Infura, etc.)
- 🔲 **Recommendation**: Consider Arweave for permanent storage

---

## ⚪ Acknowledged Design Trade-offs

### 9. VP is Non-Transferable

**Design Choice**: VP (balances) cannot be transferred between users.

**Rationale**:

- VP represents staking position, not a tradeable asset
- Prevents VP farming/selling markets
- Users stake vDOT directly to get VP

---

### 10. Topic-Based NFT Uniqueness

**Design Choice**: Only one NFT can be minted per topic.

**Implication**:

- First minter gets the NFT
- Other contributors cannot mint the same topic

**Rationale**: Creates scarcity and incentivizes quick, quality contributions.

---

### 11. Settlement is Operator-Controlled

**Design Choice**: Only operators can submit settlements, not users.

**Rationale**:

- Prevents spam/griefing settlements
- Centralizes responsibility for correct calculations
- Gas costs borne by project, not users

---

## 📋 Risk Mitigation Checklist

| Risk                   | Severity | Mitigated | Further Action           |
| ---------------------- | -------- | --------- | ------------------------ |
| Owner privileges       | High     | Partial   | Use multi-sig + timelock |
| Backend dependency     | High     | Partial   | 7-day emergency exit     |
| Gas exhaustion         | Medium   | Yes       | Monitor and adjust       |
| Signature malleability | Medium   | Yes       | OpenZeppelin handles     |
| Reentrancy             | Medium   | Yes       | Guards in place          |
| Timestamp manipulation | Low      | N/A       | Acceptable risk          |
| Front-running init     | Low      | Partial   | Deployment scripts       |
| IPFS availability      | Low      | No        | Add pinning redundancy   |

---

## Disclaimer

This document represents our current understanding of risks as of the stated date. New vulnerabilities may be discovered, and the threat landscape may change. Regular security reviews are recommended.
