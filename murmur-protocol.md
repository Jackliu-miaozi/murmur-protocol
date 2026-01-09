
```md
# Murmur Protocol（耳语坊协议）白皮书 v0.9.1（修订稿）

**A Public Murmuring Layer on Asset Hub (revm EVM)**

- 网络：Asset Hub（EVM 执行环境：revm / revive 路线）
- 发布日期：2026-01-07
- 状态：可发布（实现与审计另行文档化）

---

## 目录

1. 摘要（Abstract）  
2. 背景与动机（Background & Motivation）  
3. 设计目标与非目标  
4. 系统概览  
5. 议题生命周期与状态机  
6. 资产与账户模型（DOT / vDOT / VP）  
7. 经济模型总览（核心公式）  
8. 表达强度税（AI 判定的褒贬成本）  
9. 反滥用与公平性（Sybil、鲸鱼、刷屏）  
10. 可观测性输出（系统产物）  
11. 参数表（v0.9.1 固化）  
12. 实现草图（合约模块与接口）

---

## 1. 摘要（Abstract）

Murmur Protocol（耳语坊协议）提供一个运行在 Asset Hub（revm EVM）上的**公共耳语层**，定位为比 OpenGov 更轻量、更低后果、更具趣味性的公共讨论空间，类似“村口”的非正式治理前置层。

协议以 **24 小时实时直播议题（Topic）** 为基本单元，每个议题包含两层结构：

- **Live Feed（直播区）**：实时滚动消息流  
- **Curated Comments（精选区）**：高认可消息沉淀为公共记忆

参与路径：

- DOT → vDOT → VP（Voice Points）
- 通过锁定 vDOT 获得 VP 用于发言
- 议题结束后可赎回 vDOT，主要成本是锁定时间与机会成本

动态定价机制：

- **表达强度税**：AI 判定褒/贬强度，强度越高 VP 成本越高  
- **议题热度税**：议题越热，基础发言成本越高  

议题结束后，「议题 + 精选留言集合」可铸造成 NFT，作为可展示、可引用的治理前置产物。

---

## 2. 背景与动机（Background & Motivation）

OpenGov 作为正式治理空间，存在结构性取舍：

- 不适合承载高频、碎片化情绪
- 提案进入时成熟度不足
- 缺乏实时互动与趣味性
- 投票者与提案者信任建立困难

因此需要一个**非正式、低后果的前置层**：

- 释放与收集社区情绪
- 实时互动与答疑
- 在进入 OpenGov 前完成试炼与预热

Murmur Protocol 正是这个“村口”。

---

## 3. 设计目标与非目标

### 3.1 设计目标

- **G1**：低后果公共讨论层  
- **G2**：24h 实时互动  
- **G3**：注意力公平定价  
- **G4**：不丢失质押收益的参与方式  
- **G5**：可沉淀的公共记忆（NFT）

### 3.2 非目标

- **N1**：不替代 OpenGov  
- **N2**：不裁决观点正确性  
- **N3**：不承诺彻底消灭刷屏

---

## 4. 系统概览

### 4.1 核心对象

- Topic（议题）
- Live Feed（直播区）
- Curated Comments（精选区）
- vDOT Vault
- VP（发言点数）
- NFT Mint

### 4.2 与 OpenGov 的关系

Murmur 产物包括：

- 热度曲线
- 精选评论集合
- NFT 记忆

作为 OpenGov 的前置共识层。

---

## 5. 议题生命周期与状态机

### 5.1 生命周期

1. Create  
2. Live（24h）  
3. Close  
4. Mint  
5. Redeem  

### 5.2 状态机

```

Draft -> Live -> Closed -> Minted -> Settled

````

---

## 6. 资产与账户模型（DOT / vDOT / VP）

### 6.1 DOT 与 vDOT

- DOT：原生资产  
- vDOT：流动质押凭证  
- 不强绑定具体 vDOT 来源

### 6.2 VP（发言点数）

- 消耗型注意力预算
- Topic-scoped
- Topic 结束后作废回收（v0.9.1）

### 6.3 参与成本

- 主要成本为锁定时间与机会成本
- 不鼓励烧 DOT

---

## 7. 经济模型总览（核心公式）

### 7.1 VP 生成

```text
VPmint = k · f(x)
f(x) = √x
````

### 7.2 发言成本

```text
Cost = Base(H) · Intensity(S) · Length(L)
```

```text
Base(H) = c0 · (1 + β · H)
Intensity(S) = 1 + α · S^p
Length(L) = 1 + γ · log(1 + L)
```

### 7.3 热度计算

```text
H = w1·log(1+msg_rate)
  + w2·log(1+unique_users)
  + w3·log(1+like_rate)
  + w4·log(1+vp_burn_rate)
```

---

## 8. 表达强度税（AI 判定）

### 8.1 判定边界

AI 只判定表达强度，不裁决观点对错。

### 8.2 输出与上链

* 输出 `S ∈ [0,1]`
* AI/预言机签名验证
* 支持降级策略

### 8.3 机制直觉

高强度表达 ≠ 禁止
而是 **更贵**

---

## 9. 反滥用与公平性

### 9.1 Sybil

* vDOT 锁定门槛
* 热度税
* 行为限速

### 9.2 鲸鱼

* √x 递减函数
* 客户端展示稀释

### 9.3 刷屏

* 长度税
* 强度税
* 热度税

---

## 10. 可观测性输出

* 热度曲线
* 参与画像
* 精选评论集合
* NFT 记忆

---

## 11. 参数表（v0.9.1）

### 11.1 议题参数

* Topic 时长：24h
* 冻结窗口：10 分钟
* 精选上限：50 条

### 11.2 VP 生成

* k = 100
* f(x) = √x

### 11.3 成本参数

* c0 = 10
* β = 0.25
* α = 2.0
* p = 2.0
* γ = 0.15

### 11.4 限速

* 最小间隔：15s
* 连续冷却：1.1x / 3 条

### 11.5 NFT

* ERC-721
* 内容：Topic Hash + Curated Hash + Version

---

## 12. 实现草图（合约）

### 12.1 合约模块

* TopicFactory
* TopicVault
* VPToken（Topic-scoped）
* MessageRegistry
* AIScoreVerifier
* CurationModule
* NFTMinter

### 12.2 关键接口

```solidity
postMessage(topicId, contentHash, length, aiScore, signature)
likeMessage(topicId, msgId)
lockVdot(topicId, amount)
redeemVdot(topicId)
closeTopic(topicId)
mintNfts(topicId, curatedSetHash)
```

```

