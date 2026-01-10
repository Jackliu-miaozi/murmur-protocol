# 基于使用场景编写合约测试的提示词指南

本文档提供如何根据 `useway.md` 中的使用场景来编写合约测试的提示词模板和最佳实践。

## 测试结构建议

### 1. 测试文件组织

建议按照使用场景的步骤来组织测试文件：

```
contracts/test/
├── 01-topic-creation.test.js      # 第1步：创建议题
├── 02-user-participation.test.js  # 第2步：用户参与讨论
├── 03-likes-curation.test.js       # 第3步：点赞与精选
├── 04-freeze-window.test.js        # 第4步：冻结窗口
├── 05-topic-closure.test.js        # 第5步：议题结束
├── 06-nft-minting.test.js          # 第6步：铸造 NFT 记忆
├── 07-vdot-redemption.test.js      # 第7步：用户赎回 vDOT
└── integration.test.js             # 完整流程集成测试
```

### 2. 测试提示词模板

#### 模板 1：单步骤场景测试

```
根据 docs/useway.md 中的第[N]步：[步骤名称]，编写完整的 Hardhat 测试用例。

要求：
1. 使用 Hardhat + Chai 测试框架
2. 测试所有相关的合约交互
3. 验证状态变化和事件发射
4. 测试边界条件和错误情况
5. 使用 describe/it 结构组织测试
6. 每个测试用例包含清晰的注释说明测试场景

测试场景：
- [从 useway.md 复制具体步骤内容]

需要测试的合约：
- [列出涉及的合约]

需要验证的点：
- [列出需要验证的状态、事件、返回值等]
```

#### 模板 2：完整流程集成测试

```
根据 docs/useway.md 中的完整使用流程，编写端到端的集成测试。

要求：
1. 模拟 Alice 从创建议题到 NFT 铸造的完整流程
2. 模拟 Bob 参与讨论的完整流程
3. 验证所有步骤的状态转换
4. 测试多用户并发场景
5. 验证 VP 的消耗和返还机制
6. 验证 vDOT 的锁定和赎回机制

测试场景：
- Alice 创建 24 小时议题
- Bob 参与讨论并发布消息
- 多个用户点赞和精选机制
- 冻结窗口行为
- 议题自动关闭
- NFT 铸造和 VP 返还
- vDOT 赎回

需要验证的关键点：
- VP 计算是否正确（100 * √vDOT）
- 创建成本计算是否正确（基础成本 × (1 + α × log(1 + 活跃topic数量))）
- 发言成本计算是否正确（Base(H) × Intensity(S) × Length(L)）
- 热度计算是否正确
- 精选区排序是否正确（点赞数优先，时间倒序）
- 冻结窗口是否阻止精选区更新
- VP 返还是否完整
- vDOT 赎回条件是否正确
```

#### 模板 3：特定功能测试

```
根据 docs/useway.md 中的 [功能名称]，编写详细的单元测试。

功能描述：
[从 useway.md 复制相关功能描述]

需要测试的场景：
1. 正常流程
2. 边界条件（最小值、最大值、临界值）
3. 错误情况（余额不足、权限不足、时间限制等）
4. 状态转换
5. 事件发射

计算公式验证：
[列出需要验证的公式，如 VP 计算、成本计算等]

测试数据：
- [提供具体的测试数据示例]
```

## 具体测试场景提示词示例

### 示例 1：创建议题测试

```
根据 docs/useway.md 第1步"创建议题"，编写完整的测试用例。

测试场景：
1. Alice 使用 1000 DOT 铸造 1000 vDOT
2. Alice 质押 1000 vDOT 获得 VP（验证 VP = 100 * √1000 ≈ 3162）
3. 查询创建费用（验证公式：基础成本 × (1 + α × log(1 + 活跃topic数量))）
4. Alice 创建 topic（验证 VP 自动扣除、topic 状态为 Live、开始计时）
5. 测试 VP 余额不足的情况
6. 测试创建多个 topic 时成本递增

需要验证：
- vDOT 铸造是否正确
- VP 计算是否正确（100 * √vDOT）
- 创建成本计算是否正确
- VP 是否从 VPToken 合约中正确扣除
- Topic 状态是否正确设置为 Live
- Topic 参数（duration, freezeWindow, curatedLimit）是否正确设置
- 事件是否正确发射
```

### 示例 2：用户参与讨论测试

```
根据 docs/useway.md 第2步"用户参与讨论"，编写完整的测试用例。

测试场景：
1. Bob 锁定 1000 vDOT 获得 topic 专用 VP（验证 VP = 100 * √1000 ≈ 3162）
2. Bob 发布消息（验证 AI 签名验证、发言成本计算、VP 销毁）
3. 测试发言成本计算：
   - Base(H) = c0 × (1 + β × H)
   - Intensity(S) = 1 + α × S^p
   - Length(L) = 1 + γ × log(1 + L)
   - Cost = Base(H) × Intensity(S) × Length(L)
4. 测试热度计算（消息速率、独立用户数、点赞速率、VP 消耗速率）
5. 测试限速机制（最小间隔 15 秒、连续发送冷却）
6. 测试 VP 余额不足的情况
7. 测试 AI 签名验证失败的情况
8. 测试违反限速规则的情况

需要验证：
- TopicVault.lockVdot 是否正确计算 VP
- AI 签名验证是否工作
- 发言成本计算是否正确
- 热度计算是否正确
- 限速机制是否生效
- VP 是否正确销毁
- 消息是否正确存储
- 事件是否正确发射
```

### 示例 3：点赞与精选测试

```
根据 docs/useway.md 第3步"点赞与精选"，编写完整的测试用例。

测试场景：
1. 多个用户点赞 Bob 的消息（验证每次点赞消耗 1 VP）
2. 验证精选区动态排序机制：
   - 按点赞数从高到低排序
   - 点赞数相同时按时间从新到旧排序
3. 测试精选区容量限制（最多 50 条）
4. 测试精选区动态更新（新消息替换点赞数最低的消息）
5. 测试精选区数量不足时按 VP 消耗量排序
6. 测试点赞触发 CurationModule.onLike()

需要验证：
- 点赞是否正确消耗 1 VP
- 精选区排序是否正确
- 精选区容量限制是否正确
- 精选区动态更新是否正确
- 事件是否正确发射
```

### 示例 4：冻结窗口测试

```
根据 docs/useway.md 第4步"冻结窗口"，编写完整的测试用例。

测试场景：
1. 议题进入最后 10 分钟冻结窗口
2. 验证 TopicFactory.isFrozen() 返回 true
3. 验证精选区在冻结窗口内不再更新
4. 验证用户仍可继续讨论和点赞，但精选区不变
5. 测试冻结窗口检测机制（通过 block.timestamp 检查）

需要验证：
- 冻结窗口检测是否正确
- 精选区是否在冻结窗口内锁定
- 用户操作是否仍可正常进行
```

### 示例 5：完整流程集成测试

```
根据 docs/useway.md 的完整使用流程，编写端到端集成测试。

测试流程：
1. Alice 创建 24 小时议题（第1步）
2. Bob 参与讨论并发布多条消息（第2步）
3. 多个用户点赞，精选区动态更新（第3步）
4. 议题进入冻结窗口（第4步）
5. 议题自动关闭（第5步）
6. 铸造 NFT 并返还 VP（第6步）
7. Bob 赎回 vDOT（第7步）

需要验证：
- 所有步骤的状态转换是否正确
- VP 的消耗和返还是否正确
- vDOT 的锁定和赎回是否正确
- NFT 铸造是否包含正确的元数据
- 多用户并发场景是否正常
- 所有事件是否正确发射
```

## 测试编写最佳实践

### 1. 使用 Fixtures 和 Helpers

```javascript
// 创建测试辅助函数
async function deployContracts() {
  // 部署所有合约
}

async function createUserWithVP(amount) {
  // 创建用户并质押 vDOT 获得 VP
}

async function createTopic(creator, duration, freezeWindow, curatedLimit) {
  // 创建议题
}
```

### 2. 时间控制

```javascript
// 使用 hardhat-network-helpers 控制时间
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// 快进时间
await time.increase(86400); // 快进 24 小时
```

### 3. 事件验证

```javascript
// 验证事件是否正确发射
await expect(tx)
  .to.emit(contract, "EventName")
  .withArgs(expectedArgs);
```

### 4. 状态验证

```javascript
// 验证状态变化
expect(await contract.getState()).to.equal(expectedState);
expect(await contract.getBalance(user)).to.equal(expectedBalance);
```

### 5. 错误处理测试

```javascript
// 测试错误情况
await expect(contract.function())
  .to.be.revertedWith("Error message");
```

## 使用提示词时的注意事项

1. **明确测试范围**：在提示词中明确说明要测试哪些功能
2. **提供具体数据**：给出具体的测试数据（如 1000 DOT、24 小时等）
3. **列出验证点**：明确列出需要验证的状态、事件、返回值
4. **包含边界条件**：要求测试边界条件和错误情况
5. **参考文档**：始终引用 `useway.md` 中的具体步骤和公式

## 示例完整提示词

```
我需要根据 docs/useway.md 编写完整的合约测试套件。

请按照以下要求编写测试：

1. 测试文件结构：
   - 01-topic-creation.test.js
   - 02-user-participation.test.js
   - 03-likes-curation.test.js
   - 04-freeze-window.test.js
   - 05-topic-closure.test.js
   - 06-nft-minting.test.js
   - 07-vdot-redemption.test.js
   - integration.test.js

2. 每个测试文件应包含：
   - 完整的合约部署设置
   - 测试辅助函数
   - 正常流程测试
   - 边界条件测试
   - 错误情况测试
   - 事件验证
   - 状态验证

3. 关键验证点：
   - VP 计算：VP = 100 * √vDOT
   - 创建成本：基础成本 × (1 + α × log(1 + 活跃topic数量))
   - 发言成本：Base(H) × Intensity(S) × Length(L)
   - 热度计算：w1×log(1+msg_rate) + w2×log(1+unique_users) + w3×log(1+like_rate) + w4×log(1+vp_burn_rate)
   - 精选区排序：点赞数优先，时间倒序
   - 冻结窗口机制
   - VP 返还机制
   - vDOT 赎回条件

4. 使用 Hardhat + Chai 测试框架
5. 所有注释使用英文
6. 测试用例描述清晰，易于理解

请参考 docs/useway.md 中的具体场景和参数来编写测试。
```
