# CurationModule 合约文档

## 概述

CurationModule 管理精选消息的选择和排名。根据点赞数和时间戳维护每个主题的精选消息列表。当主题关闭时，如果精选消息少于限制，会用 VP 消耗最高的消息填充。

**合约文件**: `contracts/CurationModule.sol`

## 核心功能

- **精选消息管理**: 自动维护每个主题的精选消息列表
- **动态更新**: 当消息收到点赞时，自动更新精选列表
- **排名算法**: 根据点赞数和时间戳对消息进行排名
- **最终确定**: 主题关闭后，可以最终确定精选消息列表

## 角色权限

- `DEFAULT_ADMIN_ROLE`: 管理员角色，可以更新配置
- `OPERATOR_ROLE`: 操作员角色，可以最终确定精选消息

## 状态变量

```solidity
ITopicFactory public topicFactory;           // TopicFactory 合约
IMessageRegistry public messageRegistry;      // MessageRegistry 合约

mapping(uint256 => uint256[]) public curatedMessages;  // 精选消息列表
mapping(uint256 => bool) public finalized;            // 是否已最终确定
mapping(uint256 => mapping(uint256 => bool)) public isInCurated;  // 消息是否在精选列表中

uint256 public constant MAX_BATCH_SIZE = 50;  // 单次处理的最大消息数
```

## 主要函数

### `onMessagePosted(uint256 topicId, uint256 messageId) external view`

处理新消息发布事件（由 MessageRegistry 调用）。

**参数**:
- `topicId`: 主题 ID
- `messageId`: 消息 ID

**说明**: 
- 新消息（0 点赞）不会立即进入精选列表
- 当消息收到点赞时才会被考虑加入精选列表

### `onLike(uint256 topicId, uint256 messageId) external`

处理点赞事件并更新精选消息（由 MessageRegistry 调用）。

**参数**:
- `topicId`: 主题 ID
- `messageId`: 消息 ID

**流程**:
1. 检查主题是否冻结或已最终确定
2. 如果消息已在精选列表中，不更新
3. 如果消息不在精选列表中：
   - 如果列表未满，直接添加
   - 如果列表已满，检查是否应该替换最低排名的消息

**替换规则**:
- 如果新消息点赞数更多，替换最低点赞数的消息
- 如果点赞数相同，优先选择更新的消息（时间戳更大）

### `getCuratedMessages(uint256 topicId) external view returns (uint256[] memory messageIds)`

获取主题的精选消息 ID 列表。

**参数**:
- `topicId`: 主题 ID

**返回**: 精选消息 ID 数组

### `curatedSetHash(uint256 topicId) external view returns (bytes32 hash)`

获取精选消息集合的哈希。

**参数**:
- `topicId`: 主题 ID

**返回**: 精选消息集合的哈希值

**用途**: 用于 NFT 元数据，确保精选消息列表的不可篡改性

### `finalized(uint256 topicId) external view returns (bool)`

检查精选消息是否已最终确定。

**参数**:
- `topicId`: 主题 ID

**返回**: 是否已最终确定

### `finalizeCuratedMessages(uint256 topicId) external onlyRole(OPERATOR_ROLE)`

最终确定精选消息。

**参数**:
- `topicId`: 主题 ID

**权限**: 仅 `OPERATOR_ROLE` 可调用

**要求**:
- 主题必须是 Closed 或 Minted 状态
- 精选消息未最终确定

**流程**:
1. 验证主题状态
2. 如果精选消息少于限制，用 VP 消耗最高的消息填充
3. 标记为已最终确定

### `setMessageRegistry(address _messageRegistry) external onlyRole(DEFAULT_ADMIN_ROLE)`

更新 MessageRegistry 地址。

**参数**:
- `_messageRegistry`: 新的 MessageRegistry 地址

**权限**: 仅 `DEFAULT_ADMIN_ROLE` 可调用

## 事件

### `CuratedMessageAdded(uint256 indexed topicId, uint256 indexed messageId)`

消息被添加到精选列表时触发。

### `CuratedMessageRemoved(uint256 indexed topicId, uint256 indexed messageId)`

消息从精选列表中移除时触发。

### `CuratedMessagesFinalized(uint256 indexed topicId)`

精选消息最终确定时触发。

### `MessageRegistryUpdated(address indexed oldAddress, address indexed newAddress)`

MessageRegistry 地址更新时触发。

## 精选算法

### 添加规则

1. **列表未满**: 直接添加到列表末尾
2. **列表已满**: 
   - 找到点赞数最少的消息
   - 如果新消息点赞数更多，替换
   - 如果点赞数相同，优先选择更新的消息

### 填充规则

当主题关闭时，如果精选消息少于限制：
- 从未精选的消息中选择 VP 消耗最高的消息
- 批量处理，每次最多处理 50 条消息
- 直到达到限制或没有更多符合条件的消息

## 使用示例

```solidity
// 获取精选消息
uint256[] memory curated = curationModule.getCuratedMessages(topicId);

// 获取精选消息哈希
bytes32 hash = curationModule.curatedSetHash(topicId);

// 最终确定精选消息
curationModule.finalizeCuratedMessages(topicId);
```

## 安全考虑

1. 只有 MessageRegistry 可以触发更新
2. 冻结窗口内不更新精选列表
3. 最终确定后不能再修改
4. 使用批量处理避免 gas 限制
