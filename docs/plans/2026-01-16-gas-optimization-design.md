# Murmur Protocol Gas 优化设计方案

## 概述

本方案将智能合约优化为 "链上只存状态，链下存储数据" 的极简模式，大幅降低 Gas 消耗并消除潜在的 Gas Limit 炸弹风险。

## 核心变更

### 1. TopicVault: Push → Pull 模式

**问题**: `refundVPForTopic` 循环遍历所有参与者，可能因 Gas 超限导致资金锁死。

**解决方案**:

- 移除 `topicParticipants` 数组
- 新增 `claimRefund(topicId)` 函数，用户主动领取
- 保留 `consumedVP[topicId][user]` 用于记录可领取金额

### 2. MessageRegistry: 存储压缩

**问题**: 存储完整 Message 结构体 + 多重数组索引，极度昂贵。

**解决方案**:

- 移除 `topicMessages[]` 和 `userTopicMessages[]` 数组
- 将消息状态压缩至 1 个 Storage Slot:
  - `author` (160 bits)
  - `likeCount` (32 bits)
  - `timestamp` (32 bits)
  - `topicId` (32 bits) - 使用压缩后的 ID
- `contentHash`, `length`, `aiScore`, `vpCost` 仅通过 Event 记录

### 3. CurationModule: 简化排序

**问题**: `_fillWithVpConsumption` 需要遍历所有消息，与移除数组后的架构不兼容。

**解决方案**:

- 移除按 VP 消耗量填充的兜底逻辑
- 精选区只包含获得过点赞的消息
- 保持 Top-N 动态替换机制

### 4. TopicFactory: 移除用户索引

**问题**: `userTopics` 数组用于跟踪用户参与的议题，但实际业务不需要。

**解决方案**:

- 移除 `userTopics` 数组
- 移除 `canUserRedeem` 函数（VP 余额是全局的，不需要检查）

## 接口变更

### ITopicVault (新增/修改)

```solidity
// 新增：用户主动领取退款
function claimRefund(uint256 topicId) external;

// 新增：查询可领取金额
function getClaimableAmount(uint256 topicId, address user) external view returns (uint256);

// 废弃：refundVPForTopic (循环退款)
```

### IMessageRegistry (简化)

```solidity
// 简化后的 Message 结构
struct MessageCore {
    address author;
    uint32 topicId;
    uint32 likeCount;
    uint32 timestamp;
}

// 移除: getMessageCount, getMessagesByTopic
// 保留: getMessage, hasUserPostedInTopic
```

### ITopicFactory (简化)

```solidity
// 移除: canUserRedeem
```

## 预期收益

| 指标        | 优化前    | 优化后    | 改善      |
| ----------- | --------- | --------- | --------- |
| 发消息 Gas  | ~150,000  | ~60,000   | -60%      |
| 点赞 Gas    | ~80,000   | ~35,000   | -56%      |
| 存储槽/消息 | 3-4       | 1         | -75%      |
| 退款风险    | 高 (循环) | 无 (Pull) | 100% 消除 |

## 迁移说明

1. 部署新合约
2. 链下索引服务 (如 The Graph) 需要监听 Event 构建消息列表
3. 前端需要调用 `claimRefund` 让用户主动领取退款
