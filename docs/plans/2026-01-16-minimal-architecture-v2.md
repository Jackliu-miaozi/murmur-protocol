# Murmur Protocol 极简链上架构设计 V2

## 设计原则

- **链上**：资产托管 + 代币铸造 + 不可篡改承诺
- **链下**：消息存储 + 点赞计数 + 精选排序 + 成本计算

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         后端服务                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ Topic管理    │ │ Message存储 │ │ 精选排序 + VP记账         ││
│  │ (PostgreSQL) │ │ (IPFS/DB)   │ │ (Redis/内存)             ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           EIP-712 签名服务                                ││
│  │  - VP批量扣除签名                                         ││
│  │  - NFT铸造签名 (含精选哈希)                                ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        区块链 (3个合约)                        │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ VDOTToken   │ │ VPToken     │ │ MurmurNFT               ││
│  │ (ERC-20)    │ │ (ERC-1155)  │ │ (ERC-721)               ││
│  │             │ │             │ │                          ││
│  │ - 基础资产   │ │ - 质押/解押 │ │ - mintWithSignature      ││
│  │             │ │ - 批量burn  │ │ - 精选哈希存储            ││
│  │             │ │ - 批量mint  │ │ - VP批量返还             ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 删除的合约

| 合约             | 原因                             |
| ---------------- | -------------------------------- |
| TopicFactory     | 议题管理完全链下，后端数据库维护 |
| MessageRegistry  | 消息存储链下，VP 扣除批量结算    |
| CurationModule   | 精选排序后端计算，只有哈希上链   |
| TopicVault       | VP 追踪合并到 VPToken            |
| AIScoreVerifier  | AI 评分验证移到后端              |
| DeploymentHelper | 不再需要                         |

## 保留的合约

### 1. VDOTToken (无变化)

标准 ERC-20，用于 vDOT 资产。

### 2. VPToken (增强版)

```solidity
// 核心功能
function stakeVdot(uint256 amount) external returns (uint256 vpAmount);
function withdrawVdot(uint256 amount) external;

// 新增：批量操作（需要后端签名）
function batchBurn(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
) external;

function batchMint(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
) external;
```

### 3. MurmurNFT (简化版)

```solidity
function mintWithSignature(
    uint256 topicId,
    bytes32 topicHash,
    bytes32 curatedHash,
    address[] calldata refundUsers,
    uint256[] calldata refundAmounts,
    bytes calldata signature
) external returns (uint256 tokenId);
```

## 用户流程

### 发消息/点赞

1. 用户在前端发消息/点赞
2. 后端存储到 IPFS/DB，记录 VP 消耗
3. 后端定期批量扣除 VP（如每小时）
4. 用户无需每次支付 Gas

### 议题结束 & NFT 铸造

1. 后端计算最终精选集
2. 后端生成签名，包含：
   - topicId, topicHash, curatedHash
   - 所有参与者及其 VP 返还金额
3. 任意参与者调用 `mintWithSignature()`
4. 链上：铸造 NFT + 批量返还 VP

## Gas 成本对比

| 操作          | 原方案      | 新方案                |
| ------------- | ----------- | --------------------- |
| 发消息        | ~60,000 gas | 0 (链下)              |
| 点赞          | ~35,000 gas | 0 (链下)              |
| VP 批量扣除   | N/A         | ~5,000/用户           |
| NFT 铸造+返还 | ~500,000+   | ~100,000 + 5,000/用户 |

## 安全机制

1. **签名验证**：所有链上操作需要后端 EIP-712 签名
2. **Nonce 防重放**：每个签名包含递增 nonce
3. **数据可验证**：精选哈希上链，任何人可验证
4. **后端签名者**：使用多签或 HSM 保护私钥

## 最终合约结构

```
contracts/
├── contracts/
│   ├── VDOTToken.sol      # ERC-20 vDOT 代币 (1.1 KB)
│   ├── VPToken.sol        # ERC-1155 VP 代币 + 批量操作 (7.3 KB)
│   ├── MurmurNFT.sol      # ERC-721 NFT + 签名铸造 (7.0 KB)
│   ├── MurmurProtocol.sol # 协议注册表 (0.8 KB)
│   └── interfaces/
│       └── IVPToken.sol   # VP 接口 (2.0 KB)
└── Total: 5 files, ~18 KB
```

### 对比

| 指标       | V1 (原始) | V1.5 (Gas 优化) | V2 (极简)  |
| ---------- | --------- | --------------- | ---------- |
| 合约数量   | 10        | 7               | **4**      |
| 代码量     | ~80 KB    | ~50 KB          | **~18 KB** |
| 发消息 Gas | 150,000   | 60,000          | **0**      |
| 点赞 Gas   | 80,000    | 35,000          | **0**      |

## 后端 API 设计

### 1. 议题管理 (Topic)

```typescript
// 创建议题
POST /api/topics
{
  title: string;
  description: string;
  duration: number;      // 秒
  freezeWindow: number;  // 秒
  curatedLimit: number;  // 精选数量
  creatorAddress: string;
}

// 获取议题
GET /api/topics/:topicId
```

### 2. 消息管理 (Message)

```typescript
// 发布消息
POST /api/topics/:topicId/messages
{
  content: string;
  authorAddress: string;
  signature: string;  // 用户签名证明身份
}

// 点赞
POST /api/messages/:messageId/like
{
  userAddress: string;
  signature: string;
}
```

### 3. VP 批量结算

```typescript
// 后端定时任务（每小时执行）
POST /api/settlements/vp-burn
{
  users: string[];
  amounts: uint256[];
}
// 后端签名后调用 VPToken.batchBurn()
```

### 4. NFT 铸造

```typescript
// 生成铸造签名
POST /api/topics/:topicId/mint-signature
{
  requesterAddress: string;
}
// 返回: { signature, topicHash, curatedHash, refundUsers, refundAmounts }

// 用户调用合约 MurmurNFT.mintWithSignature()
```

## EIP-712 签名格式

### BatchBurn

```solidity
struct BatchBurn {
    address[] users;
    uint256[] amounts;
    uint256 nonce;
}

bytes32 constant BATCH_BURN_TYPEHASH = keccak256(
    "BatchBurn(address[] users,uint256[] amounts,uint256 nonce)"
);
```

### MintNFT

```solidity
struct MintNFT {
    uint256 topicId;
    bytes32 topicHash;
    bytes32 curatedHash;
    address[] refundUsers;
    uint256[] refundAmounts;
    uint256 nonce;
}

bytes32 constant MINT_TYPEHASH = keccak256(
    "MintNFT(uint256 topicId,bytes32 topicHash,bytes32 curatedHash,address[] refundUsers,uint256[] refundAmounts,uint256 nonce)"
);
```

## 数据存储

| 数据        | 存储位置           | 说明         |
| ----------- | ------------------ | ------------ |
| vDOT 余额   | 链上               | ERC-20       |
| VP 余额     | 链上               | ERC-1155     |
| NFT         | 链上               | ERC-721      |
| 精选哈希    | 链上               | NFT metadata |
| 议题信息    | PostgreSQL         | 链下         |
| 消息内容    | IPFS + PostgreSQL  | 链下         |
| 点赞记录    | Redis + PostgreSQL | 链下         |
| VP 消耗记录 | PostgreSQL         | 用于结算     |
