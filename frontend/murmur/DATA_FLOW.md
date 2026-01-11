# 消息数据读取流程

## 数据来源

消息信息来自两个地方：
1. **链上数据**（智能合约）：消息元数据
2. **IPFS**：消息实际内容

## 数据读取流程

### 1. 从链上读取消息列表

```typescript
// 使用 useTopicMessages hook
const { messages } = useTopicMessages(topicId, 0n, 100n);
```

**合约调用：**
- `MessageRegistry.getMessagesByTopic(topicId, offset, limit)`
- 返回：`Message[]` 包含：
  - `messageId`: 消息ID
  - `author`: 作者地址
  - `contentHash`: 内容哈希（bytes32，用于查找IPFS内容）
  - `aiScore`: AI强度分数
  - `vpCost`: VP消耗
  - `likeCount`: 点赞数
  - `timestamp`: 时间戳

### 2. 从IPFS读取消息内容

**步骤：**
1. 使用 `contentHash` 查找 IPFS hash 映射
2. 从 IPFS 获取实际内容

**映射存储：**
- 发布消息时，`contentHash -> ipfsHash` 映射存储在 localStorage
- 映射键：`murmur_ipfs_hash_mapping`

**IPFS 获取：**
```typescript
// 1. 从映射获取 IPFS hash
const ipfsHash = getIpfsHash(contentHash);

// 2. 从 IPFS 获取内容
const content = await fetchMessageContent(ipfsHash);
```

### 3. 精选消息

**合约调用：**
- `CurationModule.getCuratedMessages(topicId)`
- 返回：精选消息ID数组

**显示逻辑：**
- 检查消息ID是否在精选列表中
- 如果是，显示"⭐ Curated"标签

## 数据流程图

```
用户打开议题详情页
    ↓
调用 useTopicMessages(topicId)
    ↓
合约返回 Message[] (包含 contentHash)
    ↓
对每个消息：
    ↓
检查 localStorage 中的 hash 映射
    ↓
找到 ipfsHash → 从 IPFS 获取内容
找不到 → 尝试 API 路由查询链上事件
    ↓
显示消息内容 + 元数据
```

## 当前限制

1. **历史消息**：如果消息是在当前浏览器会话之前发布的，localStorage 中可能没有映射
   - **解决方案**：需要链下索引服务或链上存储 IPFS hash

2. **IPFS 网关**：使用 Pinata Gateway，需要确保网关可访问

3. **内容哈希映射**：目前使用 localStorage，刷新后可能丢失（已修复为持久化）

## 改进建议

1. **链上存储 IPFS hash**：在 MessagePosted 事件中包含 IPFS hash（需要修改合约）
2. **索引服务**：创建后端服务索引所有 MessagePosted 事件
3. **IPFS 网关备选**：支持多个 IPFS 网关（Pinata、Infura、公共网关等）
