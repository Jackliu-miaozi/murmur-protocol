# 后端迁移功能总结

## 快速参考表

| 合约 | 功能 | 迁移理由 | 优先级 | Gas节省 |
|------|------|---------|--------|---------|
| MessageRegistry | `calculateMessageCost()` | 纯计算，用户需提前知道 | 高 | 40% |
| MessageRegistry | `calculateHeat()` | 纯计算，频繁查询 | 高 | 100% |
| MessageRegistry | `getMessagesByTopic()` | 纯查询，gas消耗高 | 高 | 100% |
| MessageRegistry | `getMessageCount()` | 纯查询，可缓存 | 高 | 100% |
| MessageRegistry | `hasUserPostedInTopic()` | 纯查询，可建索引 | 中 | 100% |
| CurationModule | `onLike()` 精选更新 | 计算复杂，可定期更新 | 中 | 75% |
| CurationModule | `getCuratedMessages()` | 纯查询 | 高 | 100% |
| TopicFactory | `quoteCreationCost()` | 纯计算，用户需提前知道 | 高 | 100% |
| TopicFactory | `isFrozen()` / `isExpired()` | 纯查询，可缓存 | 中 | 100% |
| TopicFactory | `canUserRedeem()` | 需遍历，gas消耗高 | 低 | 100% |
| TopicVault | `canRedeem()` | 纯查询 | 低 | 100% |
| NFTMinter | `tokenURI()` | 字符串拼接gas高 | 高 | 80% |
| VPToken | `calculateVP()` | 纯计算，用户需提前知道 | 中 | 100% |

## 迁移原则

### ✅ 可以移到后端
- 纯查询函数（view/pure）
- 计算密集型函数
- 数据聚合和列表查询
- 成本预估和统计

### ❌ 必须保留在链上
- 资产转移（VP 铸造/销毁）
- 状态变更（消息发布、点赞）
- 权限验证
- 最终结果存储（精选列表哈希）

## 实施建议

### 第一阶段（立即实施）
1. 所有 `get*` 查询函数 → 后端 API
2. `tokenURI()` → 后端 API
3. `calculateMessageCost()` → 后端计算 + 链上验证

### 第二阶段（短期实施）
1. `calculateHeat()` → 后端计算 + 缓存
2. `quoteCreationCost()` → 后端计算
3. `getCuratedMessages()` → 后端查询

### 第三阶段（长期优化）
1. 精选列表更新逻辑 → 后端定期计算 + 链上批量更新
2. 复杂状态检查 → 后端缓存

## 预期收益

- **Gas 节省**: 60-80%
- **性能提升**: 10-100 倍
- **功能增强**: 分页、排序、搜索、统计
- **用户体验**: 更快的响应、更丰富的数据

## 详细文档

请参考 [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) 获取完整的迁移方案和实现细节。
