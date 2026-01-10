# Murmur Protocol 合约部署指南

## 合约架构

Murmur Protocol 由以下核心合约组成：

1. **VPToken.sol** - 全局 VP Token 管理（ERC-1155 + AccessControl）
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
- `initialOwner`: 合约所有者地址（会获得 DEFAULT_ADMIN_ROLE, BURNER_ROLE, MINTER_ROLE）

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

### 5. 部署 CurationModule
```solidity
CurationModule(topicFactoryAddress, messageRegistryAddress, initialOwner)
```
**注意**: 需要先部署 MessageRegistry 获取地址

### 6. 部署 MessageRegistry
```solidity
MessageRegistry(topicFactoryAddress, topicVaultAddress, aiVerifierAddress, curationModuleAddress, initialOwner)
```

### 7. 部署 NFTMinter
```solidity
NFTMinter(topicFactoryAddress, curationModuleAddress, messageRegistryAddress, topicVaultAddress, initialOwner)
```

## 部署后配置

### 必须执行的配置步骤

```solidity
// 1. 配置 TopicVault - 设置 MessageRegistry 地址
topicVault.setMessageRegistry(messageRegistryAddress);

// 2. 配置 VPToken - 授予 TopicFactory BURNER_ROLE
vpToken.grantRole(BURNER_ROLE, topicFactoryAddress);

// 3. 配置 VPToken - 授予 TopicVault MINTER_ROLE (用于 VP 返还)
vpToken.grantRole(MINTER_ROLE, topicVaultAddress);

// 4. 配置 TopicFactory - 授予 NFTMinter NFT_MINTER_ROLE
topicFactory.grantRole(NFT_MINTER_ROLE, nftMinterAddress);

// 5. 配置 TopicFactory - 授予 MessageRegistry 和 TopicVault OPERATOR_ROLE
topicFactory.grantRole(OPERATOR_ROLE, messageRegistryAddress);
topicFactory.grantRole(OPERATOR_ROLE, topicVaultAddress);

// 6. 配置 CurationModule - 授予 NFTMinter OPERATOR_ROLE
curationModule.grantRole(OPERATOR_ROLE, nftMinterAddress);

// 7. 配置 TopicVault - 授予 NFTMinter OPERATOR_ROLE (用于 VP 返还)
topicVault.grantRole(OPERATOR_ROLE, nftMinterAddress);
```

## 使用场景验证

### 第1步：创建议题
```solidity
// Alice 质押 vDOT 获得 VP
vdotToken.approve(vpTokenAddress, 1000e18);
vpToken.stakeVdot(1000e18); // 获得约 3162 VP

// 查询创建费用
uint256 cost = topicFactory.quoteCreationCost();

// 创建议题
uint256 topicId = topicFactory.createTopic(
    metadataHash,
    86400,  // 24 hours
    600,    // 10 minutes freeze
    50      // curated limit
);
```

### 第2步：用户参与讨论
```solidity
// Bob 锁定 vDOT 获得 topic VP
uint256 vpAmount = topicVault.lockVdot(topicId, 1000e18);

// 发布消息
uint256 messageId = messageRegistry.postMessage(
    topicId,
    contentHash,
    length,
    aiScore,
    timestamp,
    signature
);
```

### 第3步：点赞与精选
```solidity
// Charlie 点赞
messageRegistry.likeMessage(topicId, messageId);
// 系统自动更新精选区
```

### 第4步：冻结窗口
```solidity
// 检查是否进入冻结
bool isFrozen = topicFactory.isFrozen(topicId);
// 冻结后精选区不再更新
```

### 第5步：议题结束
```solidity
// 关闭议题
topicFactory.closeTopic(topicId);
// 或自动检查关闭
topicFactory.checkAndCloseTopic(topicId);
```

### 第6步：铸造 NFT
```solidity
// 任何发过言的用户都可以铸造
uint256 tokenId = nftMinter.mintNfts(topicId);
// 系统自动：标记已铸造、返还 VP
```

### 第7步：赎回 vDOT
```solidity
// 检查是否可以赎回
bool canRedeem = topicVault.canRedeem(userAddress);

// 赎回 vDOT
vpToken.withdrawVdot(amount);
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
- `P = 2`: 强度指数
- `GAMMA = 0.15`: 长度系数
- `MIN_INTERVAL = 15`: 最小发消息间隔（秒）
- `CONSECUTIVE_COOLDOWN = 3`: 连续发送冷却阈值
- `COOLDOWN_MULTIPLIER = 1.1x`: 冷却倍数
- `LIKE_COST = 1 * 1e18`: 点赞成本（1 VP）

### AIScoreVerifier
- `signatureValidityWindow = 600`: 签名有效窗口（10分钟）
- `fallbackModeEnabled = false`: 降级模式
- `defaultScore = 0.5`: 默认分数

## 安全说明

所有合约使用 OpenZeppelin 的 AccessControl 进行权限管理：
- `DEFAULT_ADMIN_ROLE`: 最高权限，可以管理其他角色
- `OPERATOR_ROLE`: 操作权限，用于合约间调用
- `BURNER_ROLE`: VP 销毁权限
- `MINTER_ROLE`: VP 铸造权限
- `NFT_MINTER_ROLE`: NFT 铸造权限

## 测试

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```
