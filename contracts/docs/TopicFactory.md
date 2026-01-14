# TopicFactory 合约文档

## 概述

TopicFactory 管理主题创建、生命周期和状态转换的合约。创建主题需要消耗 VP，成本会随着活跃主题数量的增加而动态调整。

**合约文件**: `contracts/TopicFactory.sol`

## 核心功能

- **主题创建**: 用户可以创建新主题，需要消耗 VP
- **生命周期管理**: 管理主题从创建到关闭的完整生命周期
- **动态成本**: 创建成本随活跃主题数量动态调整
- **状态转换**: 管理主题状态（Live → Closed → Minted）

## 主题状态

```solidity
enum TopicStatus {
    Draft,    // 草稿状态（未使用）
    Live,     // 活跃状态
    Closed,   // 已关闭
    Minted,   // 已铸造 NFT
    Settled   // 已结算（未使用）
}
```

## 角色权限

- `DEFAULT_ADMIN_ROLE`: 管理员角色，可以更新配置参数
- `OPERATOR_ROLE`: 操作员角色
- `NFT_MINTER_ROLE`: NFT 铸造者角色，可以将主题标记为已铸造

## 状态变量

```solidity
IVPToken public vpToken;                    // VP 代币合约
uint256 public topicCounter;                // 主题计数器
mapping(uint256 => Topic) public topics;    // 主题存储
uint256 public activeTopicCount;            // 活跃主题数量
uint256 public baseCreationCost = 1000 * 1e18;  // 基础创建成本
uint256 public alpha = 2 * 1e18;            // Alpha 系数
mapping(address => uint256[]) public userTopics;  // 用户参与的主题
```

## Topic 结构

```solidity
struct Topic {
    uint256 topicId;           // 主题 ID
    address creator;          // 创建者
    bytes32 metadataHash;     // 元数据哈希
    uint256 createdAt;        // 创建时间
    uint256 duration;         // 持续时间（秒）
    uint256 freezeWindow;      // 冻结窗口（秒）
    uint256 curatedLimit;     // 精选消息数量限制
    TopicStatus status;       // 状态
    bool minted;              // 是否已铸造 NFT
}
```

## 主要函数

### `createTopic(bytes32 metadataHash, uint256 topicDuration_, uint256 freezeWindow_, uint256 curatedLimit_) external nonReentrant returns (uint256 topicId)`

创建新主题。

**参数**:
- `metadataHash`: 主题元数据哈希
- `topicDuration_`: 主题持续时间（秒）
- `freezeWindow_`: 冻结窗口（秒），必须小于持续时间
- `curatedLimit_`: 最大精选消息数量（1-100）

**返回**: 创建的主题 ID

**流程**:
1. 验证参数有效性
2. 计算创建成本
3. 从用户账户销毁 VP
4. 创建主题并设置为 Live 状态
5. 更新活跃主题计数

### `quoteCreationCost() public view returns (uint256 cost)`

获取创建主题的成本报价。

**返回**: 创建成本（VP）

**计算公式**: `cost = baseCost * (1 + alpha * log(1 + activeTopicCount))`

### `getTopic(uint256 topicId) external view returns (Topic memory topic)`

获取主题信息。

**参数**:
- `topicId`: 主题 ID

**返回**: 主题结构体

### `isFrozen(uint256 topicId) public view returns (bool frozen)`

检查主题是否处于冻结窗口。

**参数**:
- `topicId`: 主题 ID

**返回**: 是否冻结

**说明**: 冻结窗口内，精选消息列表不再更新

### `isExpired(uint256 topicId) public view returns (bool expired)`

检查主题是否已过期。

**参数**:
- `topicId`: 主题 ID

**返回**: 是否过期

**判断**: `elapsed >= duration`

### `checkAndCloseTopic(uint256 topicId) external returns (bool closed)`

检查并关闭已过期的主题。

**参数**:
- `topicId`: 主题 ID

**返回**: 是否成功关闭

**说明**: 任何人都可以调用，用于自动关闭过期主题

### `closeTopic(uint256 topicId) external`

手动关闭主题（需要主题已过期）。

**参数**:
- `topicId`: 主题 ID

### `markMinted(uint256 topicId) external onlyRole(NFT_MINTER_ROLE)`

将主题标记为已铸造 NFT。

**参数**:
- `topicId`: 主题 ID

**权限**: 仅 `NFT_MINTER_ROLE` 可调用

**行为**: 将主题状态改为 `Minted`

### `canUserRedeem(address user) external view returns (bool canRedeem)`

检查用户是否可以赎回（所有参与的主题都已关闭/已铸造/已结算）。

**参数**:
- `user`: 用户地址

**返回**: 是否可以赎回

### `updateCreationCost(uint256 _baseCost, uint256 _alpha) external onlyRole(DEFAULT_ADMIN_ROLE)`

更新创建成本参数。

**参数**:
- `_baseCost`: 基础成本
- `_alpha`: Alpha 系数

**权限**: 仅 `DEFAULT_ADMIN_ROLE` 可调用

## 事件

### `TopicCreated(uint256 indexed topicId, address indexed creator, bytes32 metadataHash, uint256 duration, uint256 freezeWindow, uint256 curatedLimit)`

主题创建时触发。

### `TopicClosed(uint256 indexed topicId)`

主题关闭时触发。

### `TopicMinted(uint256 indexed topicId)`

主题标记为已铸造 NFT 时触发。

### `CreationCostUpdated(uint256 baseCost, uint256 alpha)`

创建成本参数更新时触发。

### `UserJoinedTopic(uint256 indexed topicId, address indexed user)`

用户加入主题时触发。

## 使用示例

```solidity
// 创建主题
uint256 topicId = topicFactory.createTopic(
    metadataHash,
    86400,  // 24 小时
    3600,   // 1 小时冻结窗口
    50      // 最多 50 条精选消息
);

// 检查是否过期
bool expired = topicFactory.isExpired(topicId);

// 关闭过期主题
topicFactory.checkAndCloseTopic(topicId);
```

## 安全考虑

1. 使用 `nonReentrant` 防止重入攻击
2. 使用 `AccessControl` 进行权限管理
3. 参数验证确保数据有效性
4. 状态机确保状态转换的正确性
