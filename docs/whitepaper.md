# Murmur Protocol（耳语坊协议）白皮书 v0.9.1

**A Public Murmuring Layer on Polkadot Asset Hub (EVM / revm)**

---

## 1. 摘要（Abstract）

Murmur Protocol（耳语坊协议）提供一个运行在 Polkadot Asset Hub（EVM / revm）上的
**公共耳语层**，定位为比 OpenGov 更轻量、更低后果、更具趣味性的公共讨论空间。

系统以 **24 小时实时直播议题（Topic）** 为基本单元，通过经济约束而非内容审查，
管理注意力与表达强度，为 OpenGov 提供真实、可沉淀的前置共识空间。

---

## 2. 背景与动机

OpenGov 作为正式治理系统，天然不适合：

- 高频、碎片化情绪表达
- 实时互动与答疑
- 提案的早期试错与预热

Murmur 的目标不是取代 OpenGov，
而是为其提供一个 **低后果、强互动的“村口”空间**。

---

## 3. 设计目标与非目标

### 设计目标
- 低后果公共讨论
- 实时互动
- 注意力公平定价
- 不丢失质押收益的参与方式
- 可沉淀的公共记忆

### 非目标
- 不提供正式治理裁决
- 不判断观点对错
- 不承诺消灭所有刷屏行为

---

## 4. 系统概览

### 核心组件
- Topic（24h 生命周期）
- Live Feed（实时聊天）
- Curated Comments（精选区）
- vDOT Vault
- VP（Voice Points）
- NFT Memory

### 与 OpenGov 的关系
Murmur 是 **OpenGov 的前置层与缓冲层**，
其产物可被提案者与投票者引用。

---

## 5. 议题生命周期

1. Create（创建）
2. Live（24h 直播）
3. Close（到期关闭）
4. Mint（NFT 铸造）
5. Redeem（vDOT 赎回）

---

## 6. 资产与账户模型

### DOT → vDOT → VP

- DOT：原生资产
- vDOT：质押凭证
- VP：发言点数（消耗型）

用户成本主要来自 **锁定时间与机会成本**。

---

## 7. 经济模型概览

### VP 生成
VP = k * sqrt(vDOT_locked)

shell
Copy code

### 发言成本
Cost = Base(H) * Intensity(S) * Length(L)

yaml
Copy code

---

## 8. 表达强度税（AI 定价）

- AI 只判断表达强度（S ∈ [0,1]）
- 不判断立场、不做审查
- 强度越高，VP 消耗越大

---

## 9. 热度税（Topic Heat Pricing）

热度 H 由以下因素组成：

- 消息速率
- 独立参与地址数
- 点赞速率
- VP 消耗速率

> 议题越火，发言越贵。

---

## 10. 精选与 NFT

- 点赞达阈值 → 进入精选区
- Topic 结束 → 精选集合铸造成 NFT
- NFT 是 **荣誉与记忆**，不是金融资产

---

## 11. 可观测产物

- 热度曲线
- 精选评论集合
- NFT 记忆
- 参与行为画像

---

## 12. 总结

Murmur Protocol 让治理不再只存在于“会议厅”，  
而是先在“村口”完成情绪释放、观点碰撞与共识预热。

它让 **治理更真实、更可参与、更接近社区本身**。