# MessageRegistry 合约文档

## 概述

MessageRegistry 管理消息发布、点赞和成本计算的合约。消息发布需要消耗 VP，成本会根据主题热度、消息长度和 AI 强度分数动态计算。

**合约文件**: `contracts/MessageRegistry.sol`

## 核心功能

- **消息发布**: 用户可以发布消息，需要消耗 VP 和 AI 签名验证
- **消息点赞**: 用户可以点赞消息，每次点赞消耗 1 VP
- **动态成本计算**: 根据主题热度、消息长度和 AI 强度计算消息成本
- **速率限制**: 防止用户频繁发布消息

## 成本计算公式

```
Cost = Base(H) * Intensity(S) * Length(L)

其中：
- Base(H) = c0 * (1 + beta * H)
- Intensity(S) = 1 + alpha * S^p
- Length(L) = 1 + gamma * log(1 + L)
- H = 主题热度（heat）
```

## 常量参数

```solidity
uint256 public constant C0 = 10 * 1e18;        // 基础成本：10 VP
uint256 public constant BETA = 25 * 1e16;      // 热度系数：0.25
uint256 public constant ALPHA = 2 * 1e18;     // 强度系数：2.0
uint256 public constant P = 2;                // 幂次：2
uint256 public constant GAMMA = 15 * 1e16;    // 长度系数：0.15
uint256 public constant LIKE_COST = 1 * 1e18; // 点赞成本：1 VP
uint256 public constant CONSECUTIVE_COOLDOWN = 3;  // 连续发布冷却阈值
uint256 public constant COOLDOWN_MULTIPLIER = 11 * 1e17;  // 冷却倍数：1.1x
```

## 状态变量

```solidity
ITopicFactory public topicFactory;           // TopicFactory 合约
ITopicVault public topicVault;               // TopicVault 合约
IVPToken public vpToken;                     // VP 代币合约
IAIScoreVerifier public aiVerifier;          // AI 验证者合约
ICurationModule public curationModule;       // 策展模块合约

mapping(uint256 => Message) public messages;  // 消息存储
uint256 public messageCounter;               // 消息计数器
mapping(uint256 => uint256[]) public topicMessages;  // 主题消息列表
mapping(uint256 => mapping(address => uint256[])) public userTopicMessages;  // 用户主题消息
mapping(uint256 => mapping(address => bool)) public hasPostedInTopic;  // 用户是否在主题中发布过

// 速率限制
mapping(address => uint256) public lastMessageTime;  // 最后消息时间
mapping(address => uint256) public consecutiveMessageCount;  // 连续消息计数
mapping(address => uint256) public lastMessageResetTime;  // 最后重置时间

// 主题统计
mapping(uint256 => uint256) public topicMessageCount;  // 主题消息数量
mapping(uint256 => uint256) public topicLikeCount;     // 主题点赞数量
mapping(uint256 => uint256) public topicVpBurned;      // 主题 VP 销毁数量
mapping(uint256 => uint256) public topicStartTime;     // 主题开始时间
mapping(uint256 => mapping(address => bool)) public topicUniqueUsers;  // 主题唯一用户
mapping(uint256 => uint256) public topicUniqueUserCount;  // 主题唯一用户数量
```

## Message 结构

```solidity
struct Message {
    uint256 messageId;    // 消息 ID
    uint256 topicId;      // 主题 ID
    address author;       // 作者地址
    bytes32 contentHash;  // 内容哈希
    uint256 length;       // 消息长度
    uint256 aiScore;      // AI 强度分数（0-1，缩放至 1e18）
    uint256 timestamp;    // 时间戳
    uint256 likeCount;    // 点赞数
    uint256 vpCost;       // VP 成本
}
```

## 主要函数

### `postMessage(uint256 topicId, bytes32 contentHash, uint256 length, uint256 aiScore, uint256 timestamp, bytes memory signature) external nonReentrant returns (uint256 messageId)`

发布消息。

**参数**:
- `topicId`: 主题 ID
- `contentHash`: 消息内容哈希
- `length`: 消息长度（字符数）
- `aiScore`: AI 强度分数（0-1，缩放至 1e18）
- `timestamp`: AI 服务时间戳
- `signature`: AI 服务签名

**返回**: 创建的消息 ID

**流程**:
1. 验证主题状态为 Live
2. 验证 AI 签名
3. 计算消息成本
4. 应用连续发布冷却倍数
5. 销毁 VP
6. 记录 VP 消耗
7. 创建消息
8. 更新主题统计
9. 触发策展模块更新

### `likeMessage(uint256 topicId, uint256 messageId) external nonReentrant`

点赞消息。

**参数**:
- `topicId`: 主题 ID
- `messageId`: 消息 ID

**流程**:
1. 验证主题状态为 Live
2. 销毁 1 VP
3. 记录 VP 消耗
4. 更新消息点赞数
5. 更新主题统计
6. 触发策展模块更新

### `calculateMessageCost(uint256 topicId, uint256 length, uint256 aiScore) public view returns (uint256 cost)`

计算消息成本。

**参数**:
- `topicId`: 主题 ID
- `length`: 消息长度
- `aiScore`: AI 强度分数

**返回**: 消息成本（VP）

### `calculateHeat(uint256 topicId) public view returns (uint256 heat)`

计算主题热度。

**参数**:
- `topicId`: 主题 ID

**返回**: 热度值（缩放至 1e18）

**计算公式**:
```
Heat = w1*log(1+msg_rate) + w2*log(1+unique_users) + w3*log(1+like_rate) + w4*log(1+vp_burn_rate)
```
其中权重 w1=w2=w3=w4=0.25

### `getMessage(uint256 messageId) external view returns (Message memory message_)`

获取消息信息。

**参数**:
- `messageId`: 消息 ID

**返回**: 消息结构体

### `getMessageCount(uint256 topicId) external view returns (uint256 count)`

获取主题的消息数量。

**参数**:
- `topicId`: 主题 ID

**返回**: 消息数量

### `getMessagesByTopic(uint256 topicId, uint256 offset, uint256 limit) external view returns (Message[] memory messages_)`

按主题获取消息列表。

**参数**:
- `topicId`: 主题 ID
- `offset`: 偏移量
- `limit`: 限制数量

**返回**: 消息数组

## 事件

### `MessagePosted(uint256 indexed messageId, uint256 indexed topicId, address indexed author, bytes32 contentHash, uint256 vpCost)`

消息发布时触发。

### `MessageLiked(uint256 indexed messageId, address indexed liker, uint256 likeCount)`

消息被点赞时触发。

### `CurationModuleUpdated(address indexed oldAddress, address indexed newAddress)`

CurationModule 地址更新时触发。

## 使用示例

```solidity
// 发布消息
uint256 messageId = messageRegistry.postMessage(
    topicId,
    contentHash,
    length,
    aiScore,
    timestamp,
    signature
);

// 点赞消息
messageRegistry.likeMessage(topicId, messageId);

// 计算消息成本
uint256 cost = messageRegistry.calculateMessageCost(topicId, length, aiScore);
```

## 安全考虑

1. 使用 `nonReentrant` 防止重入攻击
2. AI 签名验证确保消息质量
3. 速率限制防止滥用
4. 连续发布冷却机制
5. 状态检查确保操作有效性
