# Murmur Protocol x OpenGov 完整场景方案 (V3)

本文档描述了 Murmur Protocol 作为 Polkadot OpenGov "前哨站"和"民意过滤器"的核心业务流程。

## 核心概念

1.  **项目空间 (Project Space)**: 项目方在 Murmur 的永久根据地，绑定 X (Twitter) 账号。
2.  **议题 (Topic)**: 项目方发起的具体提案讨论。在 Murmur 上从"预热"到"落地"的全生命周期载体。
3.  **严格时序 (Strict Sequence)**: 一个项目同一时间只能有一个活跃议题。只有当前议题"落地/结办"后，才能开启下一个。这在前端呈现为一条清晰的**项目发展时间线**。

---

## 角色与经济模型

- **项目方 (Proposer)**:
  - **消耗**: 每次创建议题需支付 **10,000 VP** (服务费，直接销毁)。
  - **恢复**: 遵循协议标准的恢复机制 (时间恢复 + 互动恢复)，鼓励项目方长期持有资产而非一次性消费。
- **社区用户 (Community)**:
  - **消耗**: 发言消耗 VP (Based on AI intensity & length)。
  - **恢复**: 优质发言获赞恢复。

---

## 详细用户旅程 (User Journey)

### 第 1 阶段：入驻与空间创建 (Setup)

- 项目方 Alice 连接钱包，创建 "MoonBridge" 项目空间。
- **验证**: 绑定项目官方 X (Twitter) 账号。
- **状态**: 项目空间建立，时间线为空，处于 `Idle` (空闲) 状态。

### 第 2 阶段：议题预热 (Warm-up / Live)

**场景**: Alice 准备向 OpenGov 申请 "$100k Marketing Treasury"。

1.  **创建议题**:

    - Alice 支付 **10,000 VP**。
    - 填写草案详情，设置标签。
    - 议题创建成功，状态为 `Live`。

2.  **双屏直播界面 (The Split View)**:

    - **左侧 (官方信源)**: 实时同步 Alice 在 X 平台的推文（含特定标签或全部动态），作为"直播画面"。
    - **右侧 (社区舆论)**: Murmur 用户的实时讨论流、精选留言区 (Curated Comments)。
    - _AI 介入_: 实时分析舆论倾向，为后续报告积累数据。

3.  **持续交流**:
    - 议题**永不关闭**，直到落地。Alice 可以随时在直播间回复质疑，修改草案。

### 第 3 阶段：一键提案 (Bridge to OpenGov)

**场景**: 经过 3 天预热，社区共识形成。

1.  **生成民意报告**:
    - Alice 点击 "Submit to OpenGov"。
    - **Backend**: 锁定当前精选留言快照。
    - **AI Agent**: 生成 "Community Sentiment Summary" (社区情绪摘要) 和 "Discussion Report" (讨论数据报告)。
2.  **链上交互 (Deep Integration)**:
    - Murmur 前端构建 Polkadot OpenGov 的 `submit_proposal` 交易数据。
    - 交易备注/元数据中附带 Murmur 的**民意报告链接/哈希**。
    - Alice 签名上链。
3.  **状态流转**:
    - Murmur 议题状态变更为 `In Referendum` (公投中)。
    - 界面显示 OpenGov 实时投票进度条 (Passing/Failing)。

### 第 4 阶段：执行与落地 (Execution & Reporting)

**场景**: OpenGov 投票通过 (Passed)。

1.  **持续跟踪**:

    - 虽然公投结束，但 Murmur 上的议题依然开放。
    - Alice 在此议题下发布"里程碑更新" (Milestone Updates)。
    - 社区继续监督执行情况。

2.  **结项 (Conclusion)**:

    - 项目执行完毕，Alice 发布"最终落地报告"。
    - Alice 将议题标记为 `Landed` (已落地/已结办)。
    - _注: 若公投失败，也需标记为 `Closed/Failed` 才能结束。_

3.  **封存**:
    - 该议题在 UI 上折叠，归入时间线历史。
    - 项目状态回到 `Idle`。

### 第 5 阶段：新的轮回 (Next Cycle)

**场景**: Alice 需要申请第二笔资金。

- 由于前一个议题已 `Landed`，Alice 现在被允许创建新议题。
- **时间线关联**: 新议题在 UI 上显示在老议题上方，形成清晰的 `Phase 1 -> Phase 2` 脉络。

---

## 关键 UI/UX 特性

- **Timeline View**:
  - 用户进入项目空间，首先看到的是垂直时间线。
  - 顶部是当前 `Live`/`In Referendum` 的议题（如有）。
  - 下方是 `Landed` 的历史议题链。
- **Discussion Arena (Live)**:
  - 极具沉浸感的聊天/直播体验，与传统的论坛/帖子列表区分开。
  - 强调"此时此刻"的在场感。

## 智能合约/后端需求概览

- **VPToken**: 支持 `burnFrom` 或 `transfer` 以支付 10k 服务费。
- **Backend**:
  - X API 集成 (Twitter Sync)。
  - OpenGov Indexer 集成 (Subsquare/Polkassembly 数据同步)。
  - State Machine: 严格控制 `Idle` -> `Active` -> `Landed` 状态流转。
  - AI Service: 摘要生成。
