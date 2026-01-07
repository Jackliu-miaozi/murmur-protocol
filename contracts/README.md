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
- **标准**：ERC-20 (vDOT), ERC-721 (NFT Memory)

## 核心合约

- `VDOTVault.sol` - vDOT 质押与赎回
- `Topic.sol` - Topic 生命周期管理
- `VPSystem.sol` - VP 生成与消耗
- `MemoryNFT.sol` - 精选评论 NFT

## 相关文档

- [白皮书](../../docs/whitepaper.md)

