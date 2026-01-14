# TopicVault 合约文档

## 概述

TopicVault 追踪 VP 消耗 per topic 用于退款。用户现在直接使用全局 VP，此合约主要用于记录 VP 消耗和退款。

**合约文件**: `contracts/TopicVault.sol`

## 核心功能

- **VP 消耗记录**: 记录每个用户在每个主题中的 VP 消耗
- **参与追踪**: 追踪每个主题的参与者
- **VP 退款**: 当主题关闭后，为所有参与者退款 VP

## 角色权限

- `DEFAULT_ADMIN_ROLE`: 管理员角色，可以更新配置
- `OPERATOR_ROLE`: 操作员角色，可以执行退款操作

## 状态变量

```solidity
ITopicFactory public topicFactory;           // TopicFactory 合约
IVPToken public vpToken;                     // VP 代币合约
address public messageRegistry;              // MessageRegistry 地址

mapping(uint256 => address[]) public topicParticipants;  // 主题参与者列表
mapping(uint256 => mapping(address => bool)) public hasParticipated;  // 是否参与
mapping(uint256 => mapping(address => uint256)) public consumedVP;  // VP 消耗记录
mapping(uint256 => bool) public vpRefunded;  // 是否已退款
```

## 主要函数

### `setMessageRegistry(address _messageRegistry) external onlyRole(DEFAULT_ADMIN_ROLE)`

设置 MessageRegistry 地址。

**参数**:
- `_messageRegistry`: MessageRegistry 地址

**权限**: 仅 `DEFAULT_ADMIN_ROLE` 可调用

### `recordVpConsumption(uint256 topicId, address from, uint256 amount) external`

记录 VP 消耗（仅 MessageRegistry 可调用）。

**参数**:
- `topicId`: 主题 ID
- `from`: 消耗 VP 的地址
- `amount`: 消耗的 VP 数量

**权限**: 仅 MessageRegistry 可调用

**流程**:
1. 验证调用者是否为 MessageRegistry
2. 记录 VP 消耗
3. 如果是新参与者，添加到参与者列表

### `canRedeem(address user) public view returns (bool)`

检查用户是否可以赎回 vDOT。

**参数**:
- `user`: 用户地址

**返回**: 是否可以赎回

**说明**: 检查用户参与的所有主题是否都已关闭

### `redeemVdot() external nonReentrant`

赎回 vDOT（已弃用，仅作为检查）。

**说明**: 
- 此函数现在仅作为检查，VP 退款由 NFTMinter 处理
- 需要用户参与的所有主题都已关闭

### `refundVPForTopic(uint256 topicId) external onlyRole(OPERATOR_ROLE)`

为所有参与者退款 VP（由 NFTMinter 调用）。

**参数**:
- `topicId`: 主题 ID

**权限**: 仅 `OPERATOR_ROLE` 可调用

**要求**:
- 主题必须是 Closed 或 Minted 状态
- 主题未已退款

**流程**:
1. 验证主题状态
2. 标记为已退款
3. 遍历所有参与者
4. 为每个参与者铸造相应数量的 VP

## 事件

### `VdotLocked(uint256 indexed topicId, address indexed user, uint256 vdotAmount, uint256 vpAmount)`

用户锁定 vDOT 时触发（已弃用）。

### `VPBurned(uint256 indexed topicId, address indexed user, uint256 amount)`

VP 被销毁时触发。

### `VPRefunded(uint256 indexed topicId, address indexed user, uint256 amount)`

VP 被退款时触发。

### `MessageRegistryUpdated(address indexed oldAddress, address indexed newAddress)`

MessageRegistry 地址更新时触发。

## 使用示例

```solidity
// 记录 VP 消耗（由 MessageRegistry 调用）
topicVault.recordVpConsumption(topicId, user, amount);

// 检查是否可以赎回
bool canRedeem = topicVault.canRedeem(user);

// 退款 VP（由 NFTMinter 调用）
topicVault.refundVPForTopic(topicId);
```

## 安全考虑

1. 使用 `nonReentrant` 防止重入攻击
2. 权限控制确保只有授权合约可以调用
3. 状态检查确保退款条件满足
4. 防止重复退款

## 注意事项

1. **已弃用功能**: `lockVdot` 和 `burn` 函数已弃用，用户现在直接使用全局 VP
2. **退款时机**: 退款在 NFT 铸造时自动触发
3. **一次性退款**: 每个主题只能退款一次
4. **参与者追踪**: 自动追踪所有参与者，无需手动注册
