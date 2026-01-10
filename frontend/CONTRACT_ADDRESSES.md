# Murmur Protocol 合约地址

本文档包含部署到本地链的所有合约地址。

## 部署信息

- **网络**: 本地开发链 (Local Node)
- **RPC URL**: `http://127.0.0.1:8545`
- **部署时间**: 2024-01-XX

## 合约地址列表

### 核心合约

| 合约名称 | 地址 | 说明 |
|---------|------|------|
| **VDOTToken** | `0x8F7F3ACA83953fa7912F9de35f7F83d15e0c4727` | vDOT ERC-20 代币合约 |
| **VPToken** | `0xbD7a70c4c55cc3f05418635E3B3ceFe03126de0a` | VP Token 管理合约 |
| **AIScoreVerifier** | `0x4a5B5B52CcF8f8bdcD7aCc39985aE1479108d55b` | AI 签名验证合约 |
| **TopicFactory** | `0xD78DdE1Ecc234335A06a1047263c3101f47B7959` | Topic 创建和生命周期管理 |
| **TopicVault** | `0x99Bb21604ac69AC2a762F46388b064c8f3fc3912` | Topic-scoped VP 管理 |
| **CurationModule** | `0xE2D24029DaAb1B8Eb443Ce371fe37a3b61fB5670` | 精选区管理合约 |
| **MessageRegistry** | `0xB436f2DcA59c66Eba3a35B576044565B5A8dFCb0` | 消息发布和点赞合约 |
| **NFTMinter** | `0xbfFB52cE5c03d767Bed3B443fd61b1472058Ce49` | NFT 铸造合约 |

## 合约地址（JSON 格式）

```json
{
  "network": "localNode",
  "rpcUrl": "http://127.0.0.1:8545",
  "contracts": {
    "VDOTToken": "0x8F7F3ACA83953fa7912F9de35f7F83d15e0c4727",
    "VPToken": "0xbD7a70c4c55cc3f05418635E3B3ceFe03126de0a",
    "AIScoreVerifier": "0x4a5B5B52CcF8f8bdcD7aCc39985aE1479108d55b",
    "TopicFactory": "0xD78DdE1Ecc234335A06a1047263c3101f47B7959",
    "TopicVault": "0x99Bb21604ac69AC2a762F46388b064c8f3fc3912",
    "CurationModule": "0xE2D24029DaAb1B8Eb443Ce371fe37a3b61fB5670",
    "MessageRegistry": "0xB436f2DcA59c66Eba3a35B576044565B5A8dFCb0",
    "NFTMinter": "0xbfFB52cE5c03d767Bed3B443fd61b1472058Ce49"
  }
}
```

## 使用说明

### 在前端代码中使用

#### JavaScript/TypeScript

```typescript
export const CONTRACT_ADDRESSES = {
  VDOTToken: "0x8F7F3ACA83953fa7912F9de35f7F83d15e0c4727",
  VPToken: "0xbD7a70c4c55cc3f05418635E3B3ceFe03126de0a",
  AIScoreVerifier: "0x4a5B5B52CcF8f8bdcD7aCc39985aE1479108d55b",
  TopicFactory: "0xD78DdE1Ecc234335A06a1047263c3101f47B7959",
  TopicVault: "0x99Bb21604ac69AC2a762F46388b064c8f3fc3912",
  CurationModule: "0xE2D24029DaAb1B8Eb443Ce371fe37a3b61fB5670",
  MessageRegistry: "0xB436f2DcA59c66Eba3a35B576044565B5A8dFCb0",
  NFTMinter: "0xbfFB52cE5c03d767Bed3B443fd61b1472058Ce49",
} as const;
```

#### 环境变量 (.env)

```env
VITE_VDOT_TOKEN_ADDRESS=0x8F7F3ACA83953fa7912F9de35f7F83d15e0c4727
VITE_VP_TOKEN_ADDRESS=0xbD7a70c4c55cc3f05418635E3B3ceFe03126de0a
VITE_AI_SCORE_VERIFIER_ADDRESS=0x4a5B5B52CcF8f8bdcD7aCc39985aE1479108d55b
VITE_TOPIC_FACTORY_ADDRESS=0xD78DdE1Ecc234335A06a1047263c3101f47B7959
VITE_TOPIC_VAULT_ADDRESS=0x99Bb21604ac69AC2a762F46388b064c8f3fc3912
VITE_CURATION_MODULE_ADDRESS=0xE2D24029DaAb1B8Eb443Ce371fe37a3b61fB5670
VITE_MESSAGE_REGISTRY_ADDRESS=0xB436f2DcA59c66Eba3a35B576044565B5A8dFCb0
VITE_NFT_MINTER_ADDRESS=0xbfFB52cE5c03d767Bed3B443fd61b1472058Ce49
VITE_RPC_URL=http://127.0.0.1:8545
```

## 注意事项

⚠️ **重要提示**：

1. 这些地址仅用于本地开发环境
2. 每次重新部署本地链时，合约地址会发生变化
3. 部署到测试网或主网时，需要更新这些地址
4. 占位符合约地址（已废弃）：
   - Placeholder CurationModule: `0x3a0150982DA5aE852a722Aa3f221f6466e02C601`
   - Temporary MessageRegistry: `0x0b80bd43743BCCfe7c1D5Ac9887D9190dE135CE4`

## 相关文档

- [合约部署步骤](../../contracts/DEPLOY_STEPS.md)
- [合约部署指南](../../contracts/DEPLOYMENT.md)
- [审计报告](../../contracts/AUDIT_REPORT.md)
