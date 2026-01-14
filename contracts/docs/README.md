# Murmur Protocol 合约文档索引

本文档目录包含所有智能合约的详细文档。

## 核心合约

### 代币合约

1. **[VPToken](./VPToken.md)** - 全局 VP（Voice Points）代币合约

   - ERC-1155 标准
   - 质押 vDOT 获得 VP
   - VP 计算公式：`VP = 100 * sqrt(vDOT)`

2. **[VDOTToken](./VDOTToken.md)** - vDOT 代币合约
   - ERC-20 标准
   - 用于测试的流动性质押衍生品代币

### 主题管理合约

3. **[TopicFactory](./TopicFactory.md)** - 主题工厂合约

   - 创建和管理主题
   - 动态成本计算
   - 生命周期管理

4. **[TopicVault](./TopicVault.md)** - 主题金库合约
   - 追踪 VP 消耗
   - VP 退款管理

### 消息系统合约

5. **[MessageRegistry](./MessageRegistry.md)** - 消息注册表合约

   - 消息发布和点赞
   - 动态成本计算
   - 主题热度计算

6. **[CurationModule](./CurationModule.md)** - 策展模块合约
   - 精选消息管理
   - 自动排名算法
   - 消息最终确定

### AI 和 NFT 合约

7. **[AIScoreVerifier](./AIScoreVerifier.md)** - AI 分数验证合约

   - EIP-712 签名验证
   - 时间戳验证
   - 回退模式支持

8. **[NFTMinter](./NFTMinter.md)** - NFT 铸造合约
   - ERC-721 标准
   - 主题记忆 NFT
   - OpenSea 兼容元数据

### 辅助合约

9. **[DeploymentHelper](./DeploymentHelper.md)** - 部署辅助合约

   - 解决循环依赖
   - CREATE2 地址计算
   - 原子化部署

10. **[MurmurProtocol](./MurmurProtocol.md)** - 主协议合约
    - 部署状态记录
    - 事件日志

## 合约交互流程

### 1. 初始设置

- 部署 VPToken 和 VDOTToken
- 部署 TopicFactory 和 TopicVault
- 使用 DeploymentHelper 部署 CurationModule 和 MessageRegistry
- 部署 AIScoreVerifier
- 部署 NFTMinter

### 2. 用户参与流程

1. 用户质押 vDOT 到 VPToken 获得全局 VP
2. 用户在 TopicFactory 中创建主题（消耗 VP）
3. 用户在 MessageRegistry 中发布消息（消耗 VP）
4. 用户可以点赞消息（消耗 VP）
5. CurationModule 自动维护精选消息列表

### 3. 结算流程

1. 主题过期后，TopicFactory 将主题状态改为 Closed
2. 用户在 NFTMinter 中铸造 NFT（需要在该主题中发布过消息）
3. NFTMinter 触发 CurationModule 最终确定精选消息
4. NFTMinter 触发 TopicVault 退款 VP 给所有参与者
5. TopicFactory 将主题状态改为 Minted

## 权限说明

### DEFAULT_ADMIN_ROLE

拥有最高权限，可以：

- 授予和撤销其他角色
- 更新合约配置参数
- 执行紧急操作

### OPERATOR_ROLE

操作员权限，可以：

- 执行退款操作
- 最终确定精选消息

### NFT_MINTER_ROLE

NFT 铸造权限，可以：

- 将主题标记为已铸造

### BURNER_ROLE

销毁权限，可以：

- 销毁 VP 代币

### MINTER_ROLE

铸造权限，可以：

- 铸造 VP 代币（用于退款）

## 优化文档

- [后端迁移方案](./BACKEND_MIGRATION.md) - 详细的后端迁移方案和理由
- [后端迁移总结](./BACKEND_MIGRATION_SUMMARY.md) - 快速参考表

## 相关文档

- [主文档](../CONTRACT_DOCUMENTATION.md) - 完整的合约文档
- [部署文档](../DEPLOYMENT.md) - 部署指南
- [测试设置](../TEST_SETUP.md) - 测试环境设置

## 合约大小限制

由于测试网要求每个合约大小控制在 25KB 以下，部分合约可能需要使用代理模式进行拆分。详情请参考主文档。
