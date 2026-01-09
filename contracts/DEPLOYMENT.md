# Murmur Protocol 合约部署指南

## 合约架构

Murmur Protocol 由以下核心合约组成：

1. **VPToken.sol** - 全局 VP Token 管理（ERC-1155）
2. **TopicFactory.sol** - Topic 创建和生命周期管理
3. **TopicVault.sol** - Topic-scoped VP 生成和管理
4. **AIScoreVerifier.sol** - AI 签名验证
5. **MessageRegistry.sol** - 消息发布和点赞
6. **CurationModule.sol** - 精选区管理
7. **NFTMinter.sol** - NFT 铸造

## 部署顺序

合约之间存在依赖关系，必须按以下顺序部署：

### 1. 部署 VPToken
```solidity
VPToken(vdotTokenAddress, initialOwner)
```
- `vdotTokenAddress`: vDOT ERC-20 代币地址
- `initialOwner`: 合约所有者地址

### 2. 部署 AIScoreVerifier
```solidity
AIScoreVerifier(aiVerifierAddress, initialOwner)
```
- `aiVerifierAddress`: AI 服务验证者地址
- `initialOwner`: 合约所有者地址

### 3. 部署 TopicFactory
```solidity
TopicFactory(vpTokenAddress, initialOwner)
```
- `vpTokenAddress`: VPToken 合约地址
- `initialOwner`: 合约所有者地址

### 4. 部署 TopicVault
```solidity
TopicVault(topicFactoryAddress, vpTokenAddress, initialOwner)
```
- `topicFactoryAddress`: TopicFactory 合约地址
- `vpTokenAddress`: VPToken 合约地址
- `initialOwner`: 合约所有者地址

### 5. 部署 CurationModule
```solidity
CurationModule(topicFactoryAddress, messageRegistryAddress, topicVaultAddress, initialOwner)
```
- `topicFactoryAddress`: TopicFactory 合约地址
- `messageRegistryAddress`: MessageRegistry 合约地址（先部署，但需要后续配置）
- `topicVaultAddress`: TopicVault 合约地址
- `initialOwner`: 合约所有者地址

### 6. 部署 MessageRegistry
```solidity
MessageRegistry(topicFactoryAddress, topicVaultAddress, aiVerifierAddress, curationModuleAddress, initialOwner)
```
- `topicFactoryAddress`: TopicFactory 合约地址
- `topicVaultAddress`: TopicVault 合约地址
- `aiVerifierAddress`: AIScoreVerifier 合约地址
- `curationModuleAddress`: CurationModule 合约地址
- `initialOwner`: 合约所有者地址

### 7. 部署 NFTMinter
```solidity
NFTMinter(topicFactoryAddress, curationModuleAddress, messageRegistryAddress, topicVaultAddress, vpTokenAddress, initialOwner)
```
- `topicFactoryAddress`: TopicFactory 合约地址
- `curationModuleAddress`: CurationModule 合约地址
- `messageRegistryAddress`: MessageRegistry 合约地址
- `topicVaultAddress`: TopicVault 合约地址
- `vpTokenAddress`: VPToken 合约地址
- `initialOwner`: 合约所有者地址

## 部署后配置

### 1. 配置 TopicVault
```solidity
topicVault.setMessageRegistry(messageRegistryAddress)
```
允许 MessageRegistry 调用 TopicVault 的 burn 函数。

### 2. 配置 VPToken（如果需要）
```solidity
vpToken.setApprovalForAll(topicFactoryAddress, true) // 用户操作
```

## 合约参数

### VPToken
- `K = 100`: VP 计算公式中的常数
- VP = 100 * sqrt(vDOT)

### TopicFactory
- `baseCreationCost = 1000 * 1e18`: 基础创建成本（1000 VP）
- `alpha = 2 * 1e18`: 增长系数（2.0）

### MessageRegistry
- `C0 = 10 * 1e18`: 基础发言成本（10 VP）
- `BETA = 0.25`: 热度系数
- `ALPHA = 2.0`: 强度系数
- `P = 2.0`: 强度指数
- `GAMMA = 0.15`: 长度系数
- `MIN_INTERVAL = 15`: 最小发消息间隔（秒）
- `CONSECUTIVE_COOLDOWN = 3`: 连续发送冷却阈值
- `COOLDOWN_MULTIPLIER = 1.1x`: 冷却倍数
- `LIKE_COST = 1 * 1e18`: 点赞成本（1 VP）

## 测试建议

1. **单元测试**：测试每个合约的核心功能
2. **集成测试**：测试合约之间的交互
3. **端到端测试**：测试完整的用户流程
4. **Gas 优化测试**：确保合约 gas 消耗合理

## 安全注意事项

1. **访问控制**：确保所有 onlyOwner 函数有适当的访问控制
2. **重入攻击**：使用 ReentrancyGuard 保护关键函数
3. **整数溢出**：Solidity 0.8+ 自动检查
4. **签名验证**：确保 AI 签名验证逻辑正确
5. **状态机**：确保 Topic 状态转换正确

## 网络配置

### Polkadot Asset Hub (EVM)
- 网络 ID: 根据实际配置
- Chain ID: 根据实际配置
- Gas Limit: 根据实际需求调整

## 升级策略

当前合约未实现可升级模式。如需升级，考虑：
1. 使用 OpenZeppelin Upgradeable 合约
2. 实现代理模式（TransparentProxy 或 UUPS）
3. 数据迁移策略

## 监控和事件

所有关键操作都发出事件，建议监控：
- Topic 创建和状态变化
- 消息发布和点赞
- VP 消耗和返还
- NFT 铸造

## 支持

如有问题，请参考：
- [白皮书](../../docs/whitepaper.md)
- [使用场景文档](../../docs/useway.md)
