# Murmur Protocol 合约文档

本文档详细说明了 Murmur Protocol 中所有智能合约的功能、事件和函数。

## 目录

1. [VPToken](#vptoken)
2. [VDOTToken](#vdot token)
3. [TopicFactory](#topicfactory)
4. [TopicVault](#topicvault)
5. [MessageRegistry](#messageregistry)
6. [CurationModule](#curationmodule)
7. [NFTMinter](#nftminter)
8. [DeploymentHelper](#deploymenthelper)

---

## VPToken

### 功能描述
全局 VP（Voice Points）代币合约，基于 ERC-1155 标准。用户可以通过质押 vDOT 来获得 VP，VP 可以在所有主题中使用。VP 计算公式：`VP = 100 * sqrt(vDOT)`

### 角色
- `DEFAULT_ADMIN_ROLE`: 管理员角色
- `BURNER_ROLE`: 可以销毁 VP 的角色
- `MINTER_ROLE`: 可以铸造 VP 的角色

### 事件

#### `VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount)`
当用户质押 vDOT 时触发
- `user`: 用户地址
- `vdotAmount`: 质押的 vDOT 数量
- `vpAmount`: 获得的 VP 数量

#### `VdotWithdrawn(address indexed user, uint256 amount)`
当用户提取质押的 vDOT 时触发
- `user`: 用户地址
- `amount`: 提取的 vDOT 数量

#### `VPBurned(address indexed user, uint256 amount)`
当 VP 被销毁时触发
- `user`: 用户地址
- `amount`: 销毁的 VP 数量

#### `VPMinted(address indexed user, uint256 amount)`
当 VP 被铸造时触发
- `user`: 用户地址
- `amount`: 铸造的 VP 数量

### 函数

#### `stakeVdot(uint256 amount) external returns (uint256 vpAmount)`
质押 vDOT 以获得 VP
- `amount`: 要质押的 vDOT 数量
- 返回：获得的 VP 数量

#### `withdrawVdot(uint256 amount) external`
提取质押的 vDOT
- `amount`: 要提取的 vDOT 数量

#### `balanceOf(address user) external view returns (uint256 balance)`
获取用户的 VP 余额
- `user`: 用户地址
- 返回：VP 余额

#### `burn(address from, uint256 amount) external`
销毁 VP 代币（可由 BURNER_ROLE、代币所有者或已授权的地址调用）
- `from`: 要销毁的地址
- `amount`: 要销毁的数量

#### `mint(address to, uint256 amount) external onlyRole(MINTER_ROLE)`
铸造 VP 代币（仅 MINTER_ROLE 可调用，用于退款）
- `to`: 接收地址
- `amount`: 铸造数量

#### `calculateVP(uint256 vdotAmount) public pure returns (uint256 vpAmount)`
计算从 vDOT 数量对应的 VP 数量
- `vdotAmount`: vDOT 数量
- 返回：VP 数量（VP = 100 * sqrt(vDOT)）

#### `emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE)`
紧急提取 vDOT（仅管理员可调用）
- `to`: 接收地址
- `amount`: 提取数量

---

## VDOTToken

### 功能描述
简单的 ERC-20 vDOT 代币合约，用于测试 Murmur Protocol。这是一个最小实现，在生产环境中应使用现有的流动性质押衍生品代币。

### 事件
继承自 ERC20 标准事件

### 函数

#### `constructor(address initialOwner)`
构造函数
- `initialOwner`: 初始所有者地址（将铸造 1,000,000 vDOT）

#### `mint(address to, uint256 amount) external onlyOwner`
铸造代币（仅用于测试）
- `to`: 接收地址
- `amount`: 铸造数量

#### `burn(uint256 amount) external`
销毁代币
- `amount`: 销毁数量

---

## TopicFactory

### 功能描述
管理主题创建、生命周期和状态转换的合约。创建主题需要消耗 VP，成本会随着活跃主题数量的增加而动态调整。

### 主题状态
- `Draft`: 草稿状态
- `Live`: 活跃状态
- `Closed`: 已关闭
- `Minted`: 已铸造 NFT
- `Settled`: 已结算

### 角色
- `DEFAULT_ADMIN_ROLE`: 管理员角色
- `OPERATOR_ROLE`: 操作员角色
- `NFT_MINTER_ROLE`: NFT 铸造者角色

### 事件

#### `TopicCreated(uint256 indexed topicId, address indexed creator, bytes32 metadataHash, uint256 duration, uint256 freezeWindow, uint256 curatedLimit)`
主题创建时触发
- `topicId`: 主题 ID
- `creator`: 创建者地址
- `metadataHash`: 主题元数据哈希
- `duration`: 主题持续时间（秒）
- `freezeWindow`: 冻结窗口（秒）
- `curatedLimit`: 精选消息数量限制

#### `TopicClosed(uint256 indexed topicId)`
主题关闭时触发
- `topicId`: 主题 ID

#### `TopicMinted(uint256 indexed topicId)`
主题标记为已铸造 NFT 时触发
- `topicId`: 主题 ID

#### `TopicSettled(uint256 indexed topicId)`
主题结算时触发
- `topicId`: 主题 ID

#### `CreationCostUpdated(uint256 baseCost, uint256 alpha)`
创建成本参数更新时触发
- `baseCost`: 基础成本
- `alpha`: Alpha 系数

#### `UserJoinedTopic(uint256 indexed topicId, address indexed user)`
用户加入主题时触发
- `topicId`: 主题 ID
- `user`: 用户地址

### 函数

#### `createTopic(bytes32 metadataHash, uint256 topicDuration_, uint256 freezeWindow_, uint256 curatedLimit_) external nonReentrant returns (uint256 topicId)`
创建新主题
- `metadataHash`: 主题元数据哈希
- `topicDuration_`: 主题持续时间（秒）
- `freezeWindow_`: 冻结窗口（秒），必须小于持续时间
- `curatedLimit_`: 最大精选消息数量（1-100）
- 返回：创建的主题 ID

#### `quoteCreationCost() public view returns (uint256 cost)`
获取创建主题的成本报价
- 返回：创建成本（VP）
- 计算公式：`cost = baseCost * (1 + alpha * log(1 + activeTopicCount))`

#### `getTopic(uint256 topicId) external view returns (Topic memory topic)`
获取主题信息
- `topicId`: 主题 ID
- 返回：主题结构体

#### `isFrozen(uint256 topicId) public view returns (bool frozen)`
检查主题是否处于冻结窗口
- `topicId`: 主题 ID
- 返回：是否冻结

#### `isExpired(uint256 topicId) public view returns (bool expired)`
检查主题是否已过期
- `topicId`: 主题 ID
- 返回：是否过期

#### `checkAndCloseTopic(uint256 topicId) external returns (bool closed)`
检查并关闭已过期的主题
- `topicId`: 主题 ID
- 返回：是否成功关闭

#### `closeTopic(uint256 topicId) external`
手动关闭主题（需要主题已过期）
- `topicId`: 主题 ID

#### `markMinted(uint256 topicId) external onlyRole(NFT_MINTER_ROLE)`
将主题标记为已铸造 NFT（仅 NFT_MINTER_ROLE 可调用）
- `topicId`: 主题 ID

#### `canUserRedeem(address user) external view returns (bool canRedeem)`
检查用户是否可以赎回（所有参与的主题都已关闭/已铸造/已结算）
- `user`: 用户地址
- 返回：是否可以赎回

#### `updateCreationCost(uint256 _baseCost, uint256 _alpha) external onlyRole(DEFAULT_ADMIN_ROLE)`
更新创建成本参数
- `_baseCost`: 基础成本
- `_alpha`: Alpha 系数

---

## TopicVault

### 功能描述
管理主题范围的 VP 生成和追踪 VP 消耗用于退款。用户可以将全局 VP 转换为主题范围的 VP，用于在该主题内发布消息和点赞。

### 角色
- `DEFAULT_ADMIN_ROLE`: 管理员角色
- `OPERATOR_ROLE`: 操作员角色（用于退款操作）

### 事件

#### `VdotLocked(uint256 indexed topicId, address indexed user, uint256 vdotAmount, uint256 vpAmount)`
用户锁定 vDOT（获得主题范围 VP）时触发
- `topicId`: 主题 ID
- `user`: 用户地址
- `vdotAmount`: vDOT 数量（用于计算，不实际锁定）
- `vpAmount`: 获得的主题范围 VP 数量

#### `VPBurned(uint256 indexed topicId, address indexed user, uint256 amount)`
主题范围 VP 被销毁时触发
- `topicId`: 主题 ID
- `user`: 用户地址
- `amount`: 销毁的 VP 数量

#### `VPRefunded(uint256 indexed topicId, address indexed user, uint256 amount)`
VP 被退款时触发
- `topicId`: 主题 ID
- `user`: 用户地址
- `amount`: 退款的 VP 数量

#### `MessageRegistryUpdated(address indexed oldAddress, address indexed newAddress)`
MessageRegistry 地址更新时触发
- `oldAddress`: 旧地址
- `newAddress`: 新地址

### 函数

#### `setMessageRegistry(address _messageRegistry) external onlyRole(DEFAULT_ADMIN_ROLE)`
设置 MessageRegistry 地址
- `_messageRegistry`: MessageRegistry 地址

#### `lockVdot(uint256 topicId, uint256 amount) external nonReentrant returns (uint256 vpAmount)`
锁定 vDOT 以获得主题范围 VP
- `topicId`: 主题 ID
- `amount`: vDOT 数量（用于 VP 计算）
- 返回：获得的主题范围 VP 数量
- 说明：用户必须有足够的全局 VP 余额，全局 VP 将被销毁并转换为主题范围 VP

#### `balanceOf(uint256 topicId, address user) external view returns (uint256 balance)`
获取主题范围的 VP 余额
- `topicId`: 主题 ID
- `user`: 用户地址
- 返回：VP 余额

#### `burn(uint256 topicId, address from, uint256 amount) external`
销毁主题范围 VP（仅 MessageRegistry 可调用）
- `topicId`: 主题 ID
- `from`: 要销毁的地址
- `amount`: 要销毁的数量

#### `canRedeem(address user) public view returns (bool)`
检查用户是否可以赎回 vDOT
- `user`: 用户地址
- 返回：是否可以赎回

#### `redeemVdot() external nonReentrant`
赎回 vDOT（需要用户参与的所有主题都已关闭）
- 说明：此函数现在仅作为检查，VP 退款由 NFTMinter 处理

#### `refundVPForTopic(uint256 topicId) external onlyRole(OPERATOR_ROLE)`
为所有参与者退款 VP（由 NFTMinter 调用）
- `topicId`: 主题 ID
- 说明：仅当主题已关闭或已铸造时才能退款，且每个主题只能退款一次

---

## MessageRegistry

### 功能描述
管理消息发布、点赞和成本计算的合约。消息发布需要消耗 VP，成本会根据主题热度、消息长度和 AI 强度分数动态计算。

### 成本计算公式
```
Cost = Base(H) * Intensity(S) * Length(L)

其中：
- Base(H) = c0 * (1 + beta * H)
- Intensity(S) = 1 + alpha * S^p
- Length(L) = 1 + gamma * log(1 + L)
- H = 主题热度（heat）
```

### 常量参数
- `C0 = 10 * 1e18`: 基础成本（10 VP）
- `BETA = 0.25`: 热度系数
- `ALPHA = 2.0`: 强度系数
- `P = 2`: 幂次
- `GAMMA = 0.15`: 长度系数
- `LIKE_COST = 1 * 1e18`: 点赞成本（1 VP）
- `MIN_INTERVAL = 15`: 最小发布间隔（秒）
- `CONSECUTIVE_COOLDOWN = 3`: 连续发布冷却阈值
- `COOLDOWN_MULTIPLIER = 1.1x`: 冷却倍数

### 事件

#### `MessagePosted(uint256 indexed messageId, uint256 indexed topicId, address indexed author, bytes32 contentHash, uint256 vpCost)`
消息发布时触发
- `messageId`: 消息 ID
- `topicId`: 主题 ID
- `author`: 作者地址
- `contentHash`: 内容哈希
- `vpCost`: 消耗的 VP 成本

#### `MessageLiked(uint256 indexed messageId, address indexed liker, uint256 likeCount)`
消息被点赞时触发
- `messageId`: 消息 ID
- `liker`: 点赞者地址
- `likeCount`: 当前总点赞数

### 函数

#### `postMessage(uint256 topicId, bytes32 contentHash, uint256 length, uint256 aiScore, uint256 timestamp, bytes memory signature) external nonReentrant returns (uint256 messageId)`
发布消息
- `topicId`: 主题 ID
- `contentHash`: 消息内容哈希
- `length`: 消息长度（字符数）
- `aiScore`: AI 强度分数（0-1，缩放至 1e18）
- `timestamp`: AI 服务时间戳
- `signature`: AI 服务签名
- 返回：创建的消息 ID
- 说明：需要验证 AI 签名，需要足够的主题范围 VP，受速率限制

#### `likeMessage(uint256 topicId, uint256 messageId) external nonReentrant`
点赞消息
- `topicId`: 主题 ID
- `messageId`: 消息 ID
- 说明：每次点赞消耗 1 VP

#### `hasUserPostedInTopic(uint256 topicId, address user) external view returns (bool hasPosted)`
检查用户是否在主题中发布过消息
- `topicId`: 主题 ID
- `user`: 用户地址
- 返回：是否发布过

#### `calculateMessageCost(uint256 topicId, uint256 length, uint256 aiScore) public view returns (uint256 cost)`
计算消息成本
- `topicId`: 主题 ID
- `length`: 消息长度
- `aiScore`: AI 强度分数
- 返回：消息成本（VP）

#### `calculateHeat(uint256 topicId) public view returns (uint256 heat)`
计算主题热度
- `topicId`: 主题 ID
- 返回：热度值（缩放至 1e18）
- 说明：基于消息速率、点赞速率、VP 销毁速率和唯一用户数

#### `getMessage(uint256 messageId) external view returns (Message memory message_)`
获取消息信息
- `messageId`: 消息 ID
- 返回：消息结构体

#### `getMessageCount(uint256 topicId) external view returns (uint256 count)`
获取主题的消息数量
- `topicId`: 主题 ID
- 返回：消息数量

#### `getMessagesByTopic(uint256 topicId, uint256 offset, uint256 limit) external view returns (Message[] memory messages_)`
按主题获取消息列表
- `topicId`: 主题 ID
- `offset`: 偏移量
- `limit`: 限制数量
- 返回：消息数组

---

## CurationModule

### 功能描述
管理精选消息的选择和排名。根据点赞数和时间戳维护每个主题的精选消息列表。当主题关闭时，如果精选消息少于限制，会用 VP 消耗最高的消息填充。

### 角色
- `DEFAULT_ADMIN_ROLE`: 管理员角色
- `OPERATOR_ROLE`: 操作员角色

### 事件

#### `CuratedMessageAdded(uint256 indexed topicId, uint256 indexed messageId)`
消息被添加到精选列表时触发
- `topicId`: 主题 ID
- `messageId`: 消息 ID

#### `CuratedMessageRemoved(uint256 indexed topicId, uint256 indexed messageId)`
消息从精选列表中移除时触发
- `topicId`: 主题 ID
- `messageId`: 消息 ID

#### `CuratedMessagesFinalized(uint256 indexed topicId)`
精选消息最终确定时触发
- `topicId`: 主题 ID

### 函数

#### `onMessagePosted(uint256 topicId, uint256 messageId) external view`
处理新消息发布事件（由 MessageRegistry 调用）
- `topicId`: 主题 ID
- `messageId`: 消息 ID
- 说明：新消息（0 点赞）不会立即进入精选列表

#### `onLike(uint256 topicId, uint256 messageId) external`
处理点赞事件并更新精选消息（由 MessageRegistry 调用）
- `topicId`: 主题 ID
- `messageId`: 消息 ID
- 说明：如果主题已冻结或已最终确定，则不更新

#### `getCuratedMessages(uint256 topicId) external view returns (uint256[] memory messageIds)`
获取主题的精选消息 ID 列表
- `topicId`: 主题 ID
- 返回：精选消息 ID 数组

#### `curatedSetHash(uint256 topicId) external view returns (bytes32 hash)`
获取精选消息集合的哈希
- `topicId`: 主题 ID
- 返回：精选消息集合的哈希值

#### `finalized(uint256 topicId) external view returns (bool)`
检查精选消息是否已最终确定
- `topicId`: 主题 ID
- 返回：是否已最终确定

#### `finalizeCuratedMessages(uint256 topicId) external onlyRole(OPERATOR_ROLE)`
最终确定精选消息（仅 OPERATOR_ROLE 可调用）
- `topicId`: 主题 ID
- 说明：仅当主题已关闭或已铸造时可调用。如果精选消息少于限制，会用 VP 消耗最高的消息填充

---

## NFTMinter

### 功能描述
为已关闭的主题铸造 NFT 记忆，并触发 VP 退款。只有在该主题中发布过消息的用户才能铸造 NFT。

### 角色
- `DEFAULT_ADMIN_ROLE`: 管理员角色
- `OPERATOR_ROLE`: 操作员角色

### NFT 元数据
- `topicId`: 主题 ID
- `topicHash`: 主题哈希
- `curatedHash`: 精选消息集合哈希
- `version`: 版本号
- `mintedAt`: 铸造时间
- `mintedBy`: 铸造者地址

### 事件

#### `NFTMinted(uint256 indexed tokenId, uint256 indexed topicId, address indexed minter, bytes32 topicHash, bytes32 curatedHash)`
NFT 被铸造时触发
- `tokenId`: NFT token ID
- `topicId`: 主题 ID
- `minter`: 铸造者地址
- `topicHash`: 主题哈希
- `curatedHash`: 精选消息集合哈希

#### `BaseImageURIUpdated(string newURI)`
基础图片 URI 更新时触发
- `newURI`: 新的基础 URI

### 函数

#### `mintNfts(uint256 topicId) external nonReentrant returns (uint256 tokenId)`
为已关闭的主题铸造 NFT
- `topicId`: 主题 ID
- 返回：铸造的 NFT token ID
- 说明：
  - 主题必须是 Closed 状态
  - 调用者必须在该主题中发布过消息
  - 如果精选消息未最终确定，会自动最终确定
  - 铸造后会将主题标记为 Minted，并触发 VP 退款

#### `getMetadata(uint256 tokenId) external view returns (NFTMetadata memory metadata)`
获取 NFT 元数据
- `tokenId`: Token ID
- 返回：NFT 元数据

#### `tokenURI(uint256 tokenId) public view override returns (string memory)`
获取 token URI（用于 OpenSea 兼容性）
- `tokenId`: Token ID
- 返回：包含 JSON 元数据的 Token URI

#### `setBaseImageURI(string memory newURI) external onlyRole(DEFAULT_ADMIN_ROLE)`
设置基础图片 URI
- `newURI`: 新的基础 URI

---

## DeploymentHelper

### 功能描述
辅助合约，用于部署有循环依赖关系的 CurationModule 和 MessageRegistry。使用 CREATE2 预计算地址并原子化部署两个合约。

### 事件

#### `CurationModuleDeployed(address indexed curationModule)`
CurationModule 部署时触发
- `curationModule`: 部署的 CurationModule 地址

#### `MessageRegistryDeployed(address indexed messageRegistry)`
MessageRegistry 部署时触发
- `messageRegistry`: 部署的 MessageRegistry 地址

### 函数

#### `computeCurationModuleAddress(address messageRegistry, bytes32 salt) public view returns (address)`
使用 CREATE2 计算 CurationModule 地址
- `messageRegistry`: MessageRegistry 地址
- `salt`: CREATE2 盐值
- 返回：计算出的地址

#### `computeMessageRegistryAddress(address topicVault, address aiVerifier, address curationModule, bytes32 salt) public view returns (address)`
使用 CREATE2 计算 MessageRegistry 地址
- `topicVault`: TopicVault 地址
- `aiVerifier`: AIScoreVerifier 地址
- `curationModule`: CurationModule 地址
- `salt`: CREATE2 盐值
- 返回：计算出的地址

#### `deployBoth(address topicVault, address aiVerifier, bytes32 curationSalt, bytes32 messageSalt) public returns (address curationModule, address messageRegistry)`
原子化部署 CurationModule 和 MessageRegistry
- `topicVault`: TopicVault 地址
- `aiVerifier`: AIScoreVerifier 地址
- `curationSalt`: CurationModule 的 CREATE2 盐值
- `messageSalt`: MessageRegistry 的 CREATE2 盐值
- 返回：部署的 CurationModule 和 MessageRegistry 地址
- 说明：使用迭代方法计算地址直到收敛，然后部署两个合约

---

## 合约交互流程

1. **初始设置**
   - 部署 VPToken 和 VDOTToken
   - 部署 TopicFactory 和 TopicVault
   - 使用 DeploymentHelper 部署 CurationModule 和 MessageRegistry
   - 部署 NFTMinter

2. **用户参与流程**
   - 用户质押 vDOT 到 VPToken 获得全局 VP
   - 用户在 TopicFactory 中创建主题（消耗 VP）
   - 用户通过 TopicVault 将全局 VP 转换为主题范围 VP
   - 用户在 MessageRegistry 中发布消息（消耗主题范围 VP）
   - 用户可以点赞消息（消耗主题范围 VP）

3. **精选和结算流程**
   - CurationModule 自动维护精选消息列表
   - 主题过期后，TopicFactory 将主题状态改为 Closed
   - 用户在 NFTMinter 中铸造 NFT（需要在该主题中发布过消息）
   - NFTMinter 触发 CurationModule 最终确定精选消息
   - NFTMinter 触发 TopicVault 退款 VP 给所有参与者
   - TopicFactory 将主题状态改为 Minted

---

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

---

## 安全特性

1. **重入攻击防护**：关键函数使用 `nonReentrant` 修饰符
2. **访问控制**：使用 OpenZeppelin 的 AccessControl
3. **速率限制**：消息发布有最小间隔和连续发布冷却
4. **签名验证**：AI 分数需要服务端签名验证
5. **状态检查**：所有操作都验证主题状态
6. **安全数学**：使用 SafeERC20 进行代币转账
