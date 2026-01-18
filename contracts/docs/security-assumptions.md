# Murmur Protocol: Security Assumptions

> 📅 Version: 3.0.0  
> 📅 Last Updated: 2026-01-18

This document outlines the security assumptions underlying the Murmur Protocol smart contracts. Auditors and developers should review these assumptions carefully.

---

## 1. Trust Model

### 1.1 Backend Operator Trust

The protocol relies on a **trusted backend service** for critical operations:

| Operation     | Trust Requirement                        |
| ------------- | ---------------------------------------- |
| VP Settlement | Operators sign balance deltas            |
| VP Withdrawal | Operators sign withdrawal authorizations |
| NFT Minting   | Operators sign mint permissions          |

**Assumption**: The backend operator private keys are:

- Stored securely in HSM (Hardware Security Module) or cloud KMS
- Accessed only by authorized server processes
- Never exposed to client-side code or logs

### 1.2 Owner Privileges

The contract `owner` has significant privileges:

| Privilege                   | Description                           |
| --------------------------- | ------------------------------------- |
| `pause()` / `unpause()`     | Can halt all non-emergency operations |
| `setOperator()`             | Can add/remove signing authority      |
| `emergencyWithdrawTokens()` | Can withdraw contract funds           |
| `setRoute()` (RouterProxy)  | Can upgrade contract implementations  |

**Assumption**: The owner address is:

- A multi-sig wallet (e.g., Gnosis Safe) with M-of-N threshold
- Controlled by trusted project team members
- Subject to governance processes for critical changes

---

## 2. Signature Security

### 2.1 EIP-712 Domain Separation

All signatures use EIP-712 typed data with domain separators:

```solidity
bytes32 private constant TYPE_HASH = keccak256(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);
```

**Assumption**: Signatures are chain-specific and contract-specific, preventing:

- Cross-chain replay attacks
- Cross-contract replay attacks

### 2.2 Nonce Management

| Contract     | Nonce Type               | Purpose                   |
| ------------ | ------------------------ | ------------------------- |
| VPSettlement | Global `settlementNonce` | Prevent settlement replay |
| VPWithdraw   | Per-user `userNonce`     | Prevent withdrawal replay |
| NFTMint      | Global `mintNonce`       | Prevent mint replay       |

**Assumption**: The backend maintains strict nonce ordering:

- Never skips nonces
- Never reuses nonces
- Retries with same nonce on transaction failure

---

## 3. Economic Assumptions

### 3.1 VP Calculation

VP is calculated using a square-root model:

$$
VP = 100 \times \sqrt{vDOT_{staked}}
$$

**Assumption**: This model:

- Provides diminishing returns for large stakers (anti-whale)
- Assumes vDOT has stable value relative to DOT
- Cannot be easily gamed through fractional deposits

### 3.2 Settlement Economics

**Assumption**: The backend settlement algorithm:

- Correctly calculates VP consumption for messages/likes
- Applies fair pricing based on content intensity
- Does not arbitrarily inflate/deflate user balances

---

## 4. External Dependencies

### 4.1 vDOT Token

**Assumption**: The vDOT token contract:

- Implements standard ERC-20 correctly
- Does not have transfer fees or rebase mechanics
- Cannot be paused or frozen by external parties

### 4.2 Block Timestamp

Emergency withdrawal uses `block.timestamp`:

```solidity
require(block.timestamp >= lastActivity + delay, "VP: cooldown not passed");
```

**Assumption**: Block timestamps:

- Are accurate within ~15 seconds
- Cannot be manipulated significantly by validators
- Are sufficient for 7-day cooldown periods

---

## 5. Upgrade Assumptions

### 5.1 RouterProxy Pattern

**Assumption**: When upgrading implementations:

- New implementations maintain storage layout compatibility
- Storage gaps (`__gap`) are used correctly
- Upgrades are tested on testnet before mainnet

### 5.2 Initialization

**Assumption**:

- `initialize()` is called immediately after deployment
- No one can front-run initialization
- Initialization can only happen once (`initialized` flag)

---

## 6. Gas Assumptions

### 6.1 Settlement Batch Limit

```solidity
uint256 public constant MAX_SETTLEMENT_BATCH = 200;
```

**Assumption**: 200 users per batch is:

- Under the block gas limit
- Sufficient for typical settlement frequency
- Adjustable by deploying new implementation if needed

---

## Summary

| Category       | Key Assumption                         |
| -------------- | -------------------------------------- |
| **Trust**      | Backend operators and owner are honest |
| **Signatures** | EIP-712 prevents replay attacks        |
| **Economics**  | Backend applies fair settlement logic  |
| **External**   | vDOT behaves as standard ERC-20        |
| **Upgrades**   | Storage layout is preserved            |
