# Murmur Protocol 部署步骤指南

## ✅ 已完成步骤

- [x] 进入 contracts 目录
- [x] 安装依赖 (`npm install`)
- [x] 编译合约 (`npx hardhat compile`)

## 📋 下一步：配置和部署

### 步骤 1: 配置私钥

你需要设置部署账户的私钥。有两种方式：

#### 方式 A: 使用 Hardhat Vars（推荐）

```bash
npx hardhat vars set PRIVATE_KEY
# 然后输入你的私钥（不会显示在屏幕上）
```

#### 方式 B: 使用环境变量

```bash
export PRIVATE_KEY=your_private_key_here
```

⚠️ **安全提示**: 不要将私钥提交到 Git 仓库！

### 步骤 2: 准备部署参数

你需要准备以下两个地址：

1. **vDOT Token 地址**: vDOT ERC-20 代币合约地址
2. **AI Verifier 地址**: AI 服务验证者的地址（用于签名验证）

### 步骤 3: 设置部署参数

有两种方式设置参数：

#### 方式 A: 使用环境变量（推荐）

```bash
export VDOT_TOKEN=0x你的vDOT代币地址
export AI_VERIFIER=0x你的AI验证者地址
```

#### 方式 B: 直接修改脚本

编辑 `scripts/deploy.js`，找到这两行并修改：

```javascript
const vdotTokenAddress = process.env.VDOT_TOKEN || "0x你的vDOT代币地址";
const aiVerifierAddress = process.env.AI_VERIFIER || "0x你的AI验证者地址";
```

### 步骤 4: 运行部署

```bash
# 部署到 Polkadot Asset Hub Testnet
npx hardhat run scripts/deploy.js --network passetHub

# 或者部署到本地节点（如果已启动）
npx hardhat run scripts/deploy.js --network localNode
```

### 步骤 5: 等待部署完成

部署脚本会自动：
1. ✅ 部署所有独立合约（VPToken, AIScoreVerifier, TopicFactory, TopicVault）
2. ✅ 使用 DeploymentHelper 处理循环依赖，部署 CurationModule 和 MessageRegistry
3. ✅ 配置所有合约（设置地址、授予角色权限）
4. ✅ 部署 NFTMinter 并完成最终配置

整个过程可能需要几分钟，请耐心等待。

### 步骤 6: 保存部署信息

部署成功后，脚本会输出所有合约地址。请保存这些地址到 `deployment.json`：

```json
{
  "network": "passetHub",
  "deployedAt": "2024-01-XX",
  "deployer": "0x...",
  "contracts": {
    "VPToken": "0x...",
    "AIScoreVerifier": "0x...",
    "TopicFactory": "0x...",
    "TopicVault": "0x...",
    "CurationModule": "0x...",
    "MessageRegistry": "0x...",
    "NFTMinter": "0x..."
  },
  "deploymentHelper": "0x..."
}
```

## 🔍 验证部署

部署完成后，你可以验证合约：

```bash
# 检查 VPToken
npx hardhat verify --network passetHub <VPToken地址> <vDOT地址> <部署者地址>

# 检查其他合约...
```

## ❌ 故障排除

### 问题 1: "insufficient funds for gas"

**解决**: 确保部署账户有足够的代币支付 gas 费用。

### 问题 2: "nonce too high" 或 "replacement transaction underpriced"

**解决**: 等待之前的交易完成，或增加 gas price。

### 问题 3: CREATE2 地址计算失败

**解决**: 检查 DeploymentHelper 的 deployBoth 函数，确保 salt 值正确。

### 问题 4: 角色权限授予失败

**解决**: 
- 确保使用正确的合约地址
- 确保调用者是合约的 DEFAULT_ADMIN_ROLE
- 检查网络连接是否正常

## 📞 需要帮助？

如果遇到问题：
1. 检查错误信息
2. 确认所有参数都正确设置
3. 检查网络连接
4. 查看 Hardhat 日志获取详细信息

## 🎯 下一步

部署完成后：
1. ✅ 验证所有合约地址
2. ✅ 在前端应用中配置合约地址
3. ✅ 测试基本功能（质押 vDOT、创建 topic 等）
4. ✅ 监控合约事件
