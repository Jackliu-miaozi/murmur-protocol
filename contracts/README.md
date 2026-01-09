# Smart Contracts

智能合约模块，实现 Murmur Protocol 的核心链上逻辑。

## 功能

- **vDOT Vault**：管理 DOT 质押与 vDOT 凭证
- **Topic 合约**：管理 24 小时议题生命周期
- **VP 系统**：VP 生成与消耗的链上逻辑
- **NFT 铸造**：Topic 结束后的精选评论 NFT 铸造
- **资产赎回**：vDOT 赎回为 DOT

## 技术栈

- **平台**：Polkadot Asset Hub
- **执行环境**：EVM / revm
- **标准**：ERC-20 (vDOT), ERC-1155 (VP), ERC-721 (NFT Memory)
- **依赖**：OpenZeppelin Contracts v5

## 核心合约

- `TopicFactory.sol` - Topic 创建、关闭与状态机
- `TopicVault.sol` - vDOT 锁仓与赎回
- `VPToken.sol` - Topic-scoped VP 余额与消耗
- `MessageRegistry.sol` - 发言与点赞记录
- `AIScoreVerifier.sol` - AI 强度评分签名验证
- `CurationModule.sol` - 精选收录逻辑
- `NFTMinter.sol` - Topic 结束后的 NFT 记忆铸造

## 辅助合约

- `interfaces/*.sol` - 外部模块接口

## 相关文档

- [白皮书](../../docs/whitepaper.md)
