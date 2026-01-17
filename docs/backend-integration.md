# Backend Integration Guide for Murmur Protocol

本文档描述后端需要实现的功能，以配合智能合约完成 Murmur Protocol 的完整业务流程。

## 目录

1. [架构概览](#架构概览)
2. [EIP-712 签名服务](#eip-712-签名服务)
3. [VP 消耗追踪](#vp-消耗追踪)
4. [VP 结算服务](#vp-结算服务)
5. [NFT 铸造服务](#nft-铸造服务)
6. [API 接口设计](#api-接口设计)
7. [数据库模型](#数据库模型)
8. [定时任务](#定时任务)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (User)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────▼─────────────┐
           │      Backend Service       │
           │  ┌─────────────────────┐  │
           │  │  Signer Service     │  │  ← EIP-712 签名
           │  ├─────────────────────┤  │
           │  │  VP Tracker         │  │  ← VP 消耗追踪
           │  ├─────────────────────┤  │
           │  │  Settlement Service │  │  ← 批量结算
           │  ├─────────────────────┤  │
           │  │  NFT Metadata       │  │  ← IPFS 元数据
           │  └─────────────────────┘  │
           └─────────────┬─────────────┘
                         │
           ┌─────────────▼─────────────┐
           │      Smart Contracts       │
           │  ┌─────────┐ ┌─────────┐  │
           │  │VP Proxy │ │NFT Proxy│  │
           │  └─────────┘ └─────────┘  │
           └───────────────────────────┘
```

---

## EIP-712 签名服务

后端需要为以下操作提供 EIP-712 签名：

### 1. VP 提现签名

```typescript
// 类型定义
const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "vpBurnAmount", type: "uint256" },
    { name: "vdotReturn", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

// Domain
const VP_DOMAIN = {
  name: "MurmurVPToken",
  version: "3",
  chainId: CHAIN_ID,
  verifyingContract: VP_PROXY_ADDRESS,
};

// 签名函数
async function signWithdraw(
  user: string,
  vpBurnAmount: bigint,
  vdotReturn: bigint,
  nonce: bigint
): Promise<string> {
  const message = { user, vpBurnAmount, vdotReturn, nonce };
  return await backendSigner._signTypedData(VP_DOMAIN, WITHDRAW_TYPES, message);
}
```

### 2. VP 结算签名

```typescript
const SETTLEMENT_TYPES = {
  Settlement: [
    { name: "users", type: "address[]" },
    { name: "deltas", type: "int256[]" },
    { name: "nonce", type: "uint256" },
  ],
};

async function signSettlement(
  users: string[],
  deltas: bigint[],
  nonce: bigint
): Promise<string> {
  // 注意：需要计算 keccak256(abi.encodePacked(users)) 和 keccak256(abi.encodePacked(deltas))
  const message = { users, deltas, nonce };
  return await backendSigner._signTypedData(
    VP_DOMAIN,
    SETTLEMENT_TYPES,
    message
  );
}
```

### 3. NFT 铸造签名

```typescript
const MINT_NFT_TYPES = {
  MintNFT: [
    { name: "topicId", type: "uint256" },
    { name: "ipfsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

const NFT_DOMAIN = {
  name: "MurmurNFT",
  version: "3",
  chainId: CHAIN_ID,
  verifyingContract: NFT_PROXY_ADDRESS,
};

async function signMintNFT(
  topicId: bigint,
  ipfsHash: string, // bytes32 hex string
  nonce: bigint
): Promise<string> {
  const message = { topicId, ipfsHash, nonce };
  return await backendSigner._signTypedData(
    NFT_DOMAIN,
    MINT_NFT_TYPES,
    message
  );
}
```

---

## VP 消耗追踪

### 核心职责

后端需要追踪用户的 VP 消耗和恢复，在链下维护"实际可用 VP"：

```typescript
interface VPAccount {
  address: string;

  // 链上数据 (从合约读取)
  onChainBalance: bigint; // VPStaking.balanceOf(user)
  onChainStaked: bigint; // VPStaking.stakedVdot(user)

  // 链下追踪
  pendingBurns: bigint; // 待扣除 (发言、点赞消耗)
  pendingMints: bigint; // 待增加 (点赞奖励、精选奖励)

  // 计算可用余额
  get effectiveBalance(): bigint;
}
```

### 消耗规则 (来自 useway_v3_unified.md)

```typescript
interface VPCostCalculator {
  // 基础费用
  BASE_COST: 2;  // VP

  // 长度系数: 1 + 0.05 * (words - 10)
  lengthFactor(wordCount: number): number {
    return 1 + 0.05 * Math.max(0, wordCount - 10);
  }

  // 情绪税: 1 + 9 * S^2
  intensityFactor(aiScore: number): number {
    return 1 + 9 * Math.pow(aiScore, 2);
  }

  // 最终成本
  calculateCost(wordCount: number, aiScore: number): number {
    return Math.ceil(
      this.BASE_COST *
      this.lengthFactor(wordCount) *
      this.intensityFactor(aiScore)
    );
  }
}

// 示例
// 温和发言 (10词, AI=0.1): 2 * 1 * 1.09 ≈ 2 VP
// 长篇激烈 (50词, AI=0.9): 2 * 3 * 8.29 ≈ 50 VP
```

### 恢复规则

```typescript
interface VPRecovery {
  // 自然恢复: 每小时 5% 上限
  naturalRecoveryRate: 0.05; // per hour

  // 点赞奖励: 每个点赞返还发言成本的 10%
  likeRewardRate: 0.1;

  // 精选奖励: 入选 Top 50 一次性 500 VP
  curatedReward: 500;
}
```

---

## VP 结算服务

### 结算时机

1. **议题结束时** - 结算该议题所有参与者的 VP 变化
2. **用户请求提现前** - 必须先结算该用户的待处理变化
3. **定时任务** - 每 6 小时处理活跃议题的增量结算

### 结算流程

```typescript
async function settleTopic(topicId: number): Promise<void> {
  // 1. 获取参与者列表
  const participants = await getTopicParticipants(topicId);

  // 2. 计算每个人的 delta
  const deltas: Map<string, bigint> = new Map();

  for (const participant of participants) {
    const burns = await getPendingBurns(participant.address, topicId);
    const mints = await getPendingMints(participant.address, topicId);
    const delta = mints - burns;

    if (delta !== 0n) {
      deltas.set(participant.address, delta);
    }
  }

  // 3. 获取当前 nonce
  const nonce = await vpContract.settlementNonce();

  // 4. 准备数据
  const users = Array.from(deltas.keys());
  const deltaValues = Array.from(deltas.values());

  // 5. 签名
  const signature = await signSettlement(users, deltaValues, nonce);

  // 6. 调用合约
  await vpContract.settleBalances(users, deltaValues, nonce, signature);

  // 7. 标记已结算
  await markAsSettled(topicId, users);
}
```

### 批量大小限制

```typescript
const MAX_BATCH_SIZE = 100; // 每次最多处理 100 个地址

async function settleLargeTopic(topicId: number): Promise<void> {
  const allParticipants = await getTopicParticipants(topicId);

  // 分批处理
  for (let i = 0; i < allParticipants.length; i += MAX_BATCH_SIZE) {
    const batch = allParticipants.slice(i, i + MAX_BATCH_SIZE);
    await settleParticipantBatch(topicId, batch);
  }
}
```

---

## NFT 铸造服务

### IPFS 元数据上传

```typescript
interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  // Murmur 特有
  topicId: number;
  curatedMessages: CuratedMessage[];
  participantStats: ParticipantStats;
}

async function uploadMetadataToIPFS(
  topicId: number,
  minter: string
): Promise<string> {
  const topic = await getTopic(topicId);
  const curatedMessages = await getCuratedMessages(topicId, minter);

  const metadata: NFTMetadata = {
    name: `Murmur Memory #${topicId}`,
    description: `A curated memory from "${topic.title}" - ${topic.summary}`,
    image: `ipfs://${await generateNFTImage(topicId)}`,
    attributes: [
      { trait_type: "Topic ID", value: topicId.toString() },
      { trait_type: "Topic Title", value: topic.title },
      {
        trait_type: "Minted At",
        display_type: "date",
        value: Date.now() / 1000,
      },
      { trait_type: "Messages Count", value: curatedMessages.length },
      { trait_type: "Version", value: "3.0.0" },
    ],
    topicId,
    curatedMessages,
    participantStats: await getParticipantStats(topicId, minter),
  };

  const { cid } = await ipfsClient.add(JSON.stringify(metadata));
  return cid.toString();
}

function cidToBytes32(cid: string): string {
  // 将 IPFS CID 转换为 bytes32
  const decoded = CID.parse(cid);
  const hash = decoded.multihash.digest;
  return "0x" + Buffer.from(hash).toString("hex").padStart(64, "0");
}
```

### 铸造流程

```typescript
async function prepareMint(
  topicId: number,
  minterAddress: string
): Promise<MintParams> {
  // 1. 检查是否已铸造
  const isMinted = await nftContract.topicMinted(topicId);
  if (isMinted) throw new Error("Already minted");

  // 2. 上传元数据到 IPFS
  const cid = await uploadMetadataToIPFS(topicId, minterAddress);
  const ipfsHash = cidToBytes32(cid);

  // 3. 获取 nonce
  const nonce = await nftContract.mintNonce();

  // 4. 签名
  const signature = await signMintNFT(BigInt(topicId), ipfsHash, nonce);

  return {
    topicId: BigInt(topicId),
    ipfsHash,
    nonce,
    signature,
  };
}
```

---

## API 接口设计

### VP 相关

```typescript
// POST /api/vp/withdraw/prepare
// 准备提现签名
interface WithdrawPrepareRequest {
  userAddress: string;
  vpBurnAmount: string; // 用户想销毁的 VP
}

interface WithdrawPrepareResponse {
  vpBurnAmount: string;
  vdotReturn: string; // 后端计算的返还金额
  nonce: string;
  signature: string;
  expiresAt: number; // 签名过期时间
}

// GET /api/vp/balance/:address
// 获取有效 VP 余额
interface VPBalanceResponse {
  onChainBalance: string;
  pendingBurns: string;
  pendingMints: string;
  effectiveBalance: string;
  maxVP: string; // 质押对应的最大 VP
}
```

### 消息相关

```typescript
// POST /api/message/send
// 发送消息 (消耗 VP)
interface SendMessageRequest {
  topicId: number;
  content: string;
  signature: string; // 用户的消息签名
}

interface SendMessageResponse {
  messageId: string;
  vpCost: number; // 本次消耗的 VP
  remainingVP: string; // 剩余有效 VP
}

// POST /api/message/like
// 点赞 (消耗 1 VP，被点赞者获得 10% 恢复)
interface LikeRequest {
  messageId: string;
}
```

### NFT 相关

```typescript
// POST /api/nft/prepare-mint
// 准备铸造 NFT
interface PrepareMintRequest {
  topicId: number;
}

interface PrepareMintResponse {
  topicId: string;
  ipfsHash: string;
  ipfsUrl: string; // ipfs://...
  nonce: string;
  signature: string;
}

// GET /api/nft/:tokenId/metadata
// 获取 NFT 元数据 (给 IPFS gateway 用)
```

---

## 数据库模型

### VP 追踪表

```sql
-- VP 操作记录
CREATE TABLE vp_operations (
  id SERIAL PRIMARY KEY,
  user_address VARCHAR(42) NOT NULL,
  topic_id INTEGER,
  operation_type VARCHAR(20) NOT NULL,  -- 'message', 'like', 'reward', 'curated'
  amount BIGINT NOT NULL,               -- 正数=获得, 负数=消耗
  reference_id VARCHAR(100),            -- 关联的消息/点赞 ID
  settled BOOLEAN DEFAULT FALSE,
  settlement_tx VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vp_ops_user ON vp_operations(user_address);
CREATE INDEX idx_vp_ops_settled ON vp_operations(settled, user_address);
CREATE INDEX idx_vp_ops_topic ON vp_operations(topic_id);

-- 用户 VP 快照 (缓存)
CREATE TABLE vp_snapshots (
  user_address VARCHAR(42) PRIMARY KEY,
  on_chain_balance NUMERIC(78),
  pending_burns NUMERIC(78) DEFAULT 0,
  pending_mints NUMERIC(78) DEFAULT 0,
  last_synced_at TIMESTAMP DEFAULT NOW()
);
```

### 结算记录表

```sql
CREATE TABLE settlements (
  id SERIAL PRIMARY KEY,
  nonce BIGINT NOT NULL UNIQUE,
  topic_id INTEGER,
  user_count INTEGER NOT NULL,
  total_burns NUMERIC(78),
  total_mints NUMERIC(78),
  tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, submitted, confirmed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);
```

---

## 定时任务

### 1. VP 自然恢复 (每小时)

```typescript
// 每小时执行
async function applyNaturalRecovery(): Promise<void> {
  const users = await getActiveUsers();

  for (const user of users) {
    const maxVP = await calculateMaxVP(user.stakedVdot);
    const currentBalance =
      user.onChainBalance - user.pendingBurns + user.pendingMints;

    // 恢复 5% 上限
    const recovery = Math.min(maxVP * 0.05, maxVP - currentBalance);

    if (recovery > 0) {
      await createVPOperation({
        userAddress: user.address,
        operationType: "natural_recovery",
        amount: recovery,
      });
    }
  }
}
```

### 2. 增量结算 (每 6 小时)

```typescript
// 每 6 小时执行
async function incrementalSettlement(): Promise<void> {
  const unsettledOps = await getUnsettledOperations();

  // 按用户聚合
  const userDeltas = aggregateByUser(unsettledOps);

  // 分批结算
  await settlementService.settleUsers(userDeltas);
}
```

### 3. 链上状态同步 (每 5 分钟)

```typescript
// 每 5 分钟执行
async function syncOnChainBalances(): Promise<void> {
  const users = await getUsersNeedingSync();

  for (const user of users) {
    const onChainBalance = await vpContract.balanceOf(user.address);
    const stakedVdot = await vpContract.stakedVdot(user.address);

    await updateVPSnapshot(user.address, {
      onChainBalance,
      stakedVdot,
    });
  }
}
```

---

## 安全考虑

### 1. 签名密钥管理

```typescript
// 推荐使用 HSM 或 KMS
const backendSigner = new ethers.Wallet(
  await kms.getPrivateKey("murmur-backend-signer")
);

// 或使用多签
const threshold = 2;
const signers = [signer1, signer2, signer3];
```

### 2. 签名过期

```typescript
// 所有签名应该有过期时间
interface SignedMessage {
  signature: string;
  expiresAt: number; // UNIX timestamp
}

// 验证时检查
if (Date.now() / 1000 > message.expiresAt) {
  throw new Error("Signature expired");
}
```

### 3. 速率限制

```typescript
// 防止滥用
const rateLimits = {
  message: { perMinute: 10, perHour: 100 },
  like: { perMinute: 30, perHour: 500 },
  withdraw: { perHour: 5 },
};
```

---

## 合约地址

部署后更新以下地址：

```typescript
const CONTRACTS = {
  VP_PROXY: "0x...",
  NFT_PROXY: "0x...",
  VDOT_TOKEN: "0x...",
  MURMUR_PROTOCOL: "0x...",
};
```

---

## 相关文档

- [使用场景](./useway_v3_unified.md)
- [智能合约](../contracts/README.md)
