# Murmur Protocol Backend Execution Plan (Useway MVP)

## Decisions (Confirmed)
- NFT minting scope: one per topic (contract-aligned).
- OpenGov status: separate `openGovStatus` field on Topic.
- Reward idempotency: unique index on `VpReward` by `(source, referenceId)`.

---

## Execution Plan (File-by-File)

### 1) Schema Alignment
- `app/viliage-gate/prisma/schema.prisma`
  - Add `Space` model and `Topic.spaceId` relation.
  - Extend `TopicStatus` with `LANDED`.
  - Add OpenGov fields on `Topic`:
    - `openGovStatus` (enum)
    - `openGovProposalId`, `openGovReportHash`, `openGovTxHash`, `openGovSubmittedAt`
  - Add `ipfsHash` field for NFT signing.
  - Change `Message.vpCost` to `Decimal(78,0)` (store 1e18 VP units).
  - Keep `MintedNFT.topicId @unique` (topic-unique minting).
  - Add `@@unique([source, referenceId])` on `VpReward`.

### 2) Chain Read Module
- `app/viliage-gate/src/server/murmur/chain.ts` (new)
  - viem public client with `RPC_URL` + `CHAIN_ID`.
  - Contract readers:
    - VP: `balanceOf`, `settlementNonce`, `userNonce`, `stakedVdot`, `calculateVP`
    - NFT: `mintNonce`, `topicMinted`
- `app/viliage-gate/src/server/murmur/index.ts`
  - Re-export chain utilities.

### 3) Auth Context
- `app/viliage-gate/src/server/api/trpc.ts`
  - Add wallet signature middleware.
  - Export `protectedProcedure` with `ctx.userAddress`.
  - All write operations should use `protectedProcedure`.

### 4) Store Layer
- `app/viliage-gate/src/server/murmur/store.ts`
  - Add `vpBalanceStore`:
    - `getEffectiveBalance`, `syncFromChain`, `deductBalance`, `applyRespiration`.
  - Add `vpRewardStore`:
    - `grantResonanceBonus`, `grantCuratedBonus` (idempotent).
  - Add `likeStore`:
    - `create(messageId, userAddress)` (unique constraint).
  - Update `messageStore.create` to store `vpCost` in 1e18 units.
  - Update `vpStore.aggregateUnsettled` to combine consumptions (burn) and rewards (mint).
  - On settlement confirmation, mark `VpReward.processed`.

### 5) Router Wiring
- `app/viliage-gate/src/server/api/root.ts`
  - Add routers: `vp`, `space`, `opengov`, `admin`, `withdraw`.

### 6) Topic Routes
- `app/viliage-gate/src/server/api/routers/topic.ts`
  - Use `protectedProcedure` for `create/close/land`.
  - Remove client-supplied `creator`; use `ctx.userAddress`.
  - Require `spaceId` and optionally `ipfsHash`.
  - Charge 10k VP on create (balance check + deduct + record).
  - `close`: creator-only and must be expired.
  - `land`: creator-only and must be `CLOSED`.

### 7) Message + Like + Rewards
- `app/viliage-gate/src/server/api/routers/message.ts`
  - Use `protectedProcedure` for `post/like`.
  - Apply useway cost formula (Base=2, Length linear, Intensity=1+9*S^2 with S=0.5).
  - Block posting during freeze window.
  - Check balance + deduct on post/like.
  - Like route writes `Like` and enforces uniqueness.
  - On like: apply 10% resonance reward.
  - On new Top50 entry: grant 500 VP curated bonus.

### 8) New Routers
- `app/viliage-gate/src/server/api/routers/vp.ts` (new)
  - `getBalance` (with respiration), `syncBalance`.
- `app/viliage-gate/src/server/api/routers/space.ts` (new)
  - create/list/get, list topics by space.
- `app/viliage-gate/src/server/api/routers/opengov.ts` (new)
  - generate report hash, update `openGovStatus`.
- `app/viliage-gate/src/server/api/routers/admin.ts` (new)
  - stats, manual settlement, admin actions.

### 9) Settlement + Withdraw
- `app/viliage-gate/src/server/api/routers/settlement.ts`
  - Read nonce from chain `settlementNonce()`.
  - Use `Settlement(address[] users,int256[] deltas,uint256 nonce)`.
  - Add `signWithdraw` (or create withdraw router).
  - Align `signMintNFT` with NFT signature format.
- `app/viliage-gate/src/server/api/routers/withdraw.ts` (new)
  - `signWithdraw` + record `WithdrawalRequest`.

### 10) Signature Spec
- `app/viliage-gate/src/server/murmur/signature.ts`
  - Domain version `3`.
  - Types:
    - `Settlement(address[] users,int256[] deltas,uint256 nonce)`
    - `Withdraw(address user,uint256 vpBurnAmount,uint256 vdotReturn,uint256 nonce)`
    - `MintNFT(address minter,uint256 topicId,bytes32 ipfsHash,uint256 nonce)`

### 11) Cron Settlement
- `app/viliage-gate/src/app/api/cron/settlement/route.ts` (new)
  - `CRON_SECRET` auth.
  - Threshold checks.
  - Chunk per 200 users.

### 12) Env Vars
- `app/viliage-gate/.env.example`
  - Add: `NEXT_PUBLIC_ROUTER_PROXY`, `NEXT_PUBLIC_CHAIN_ID`,
    `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
    `CRON_SECRET`, `SETTLEMENT_THRESHOLD_VP`, `MIN_SETTLEMENT_USERS`,
    `AI_FIXED_SCORE`.
