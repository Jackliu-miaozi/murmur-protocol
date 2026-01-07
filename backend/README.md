# Backend Service

后端服务模块，处理 Murmur Protocol 的核心业务逻辑。

## 功能

- **议题管理**：创建、查询、关闭 Topic
- **实时聊天**：Live Feed 消息处理
- **精选管理**：点赞阈值判断、精选区维护
- **VP 计算**：根据 vDOT 锁定量计算 Voice Points
- **热度计算**：实时计算 Topic 热度（H）
- **成本计算**：发言成本 = Base(H) * Intensity(S) * Length(L)
- **NFT 铸造**：Topic 结束后铸造精选评论 NFT

## 核心模块

- Topic 生命周期管理
- Live Feed 实时消息处理
- Curated Comments 精选区
- vDOT Vault 管理
- VP 生成与消耗
- 热度税计算

## 相关文档

- [白皮书](../../docs/whitepaper.md)

