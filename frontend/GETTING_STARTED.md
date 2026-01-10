# Murmur Protocol 前端快速开始指南

## ✅ 已完成的功能

### 核心功能
- ✅ 多钱包连接（Polkadot.js、SubWallet、Talisman）
- ✅ VP 代币管理（质押 vDOT、获取 VP、提取 vDOT）
- ✅ 议题创建和浏览
- ✅ 实时消息发送和点赞
- ✅ 精选消息展示
- ✅ NFT 铸造和画廊
- ✅ IPFS 内容存储（通过 Pinata）
- ✅ AI 消息评分（EIP-712 签名）

### 技术栈
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Polkadot.js
- Zustand (状态管理)
- Ethers.js (EIP-712 签名)

## 🚀 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

复制环境变量模板：
```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，确保以下变量已设置：

```env
# RPC 节点（Rococo 测试网）
NEXT_PUBLIC_CHAIN_RPC=wss://rococo-contracts-rpc.polkadot.io

# 合约地址（已部署）
NEXT_PUBLIC_VPTOKEN_ADDRESS=0xC530e4cD4933357da902577E78cC7C65C5759e0C
NEXT_PUBLIC_AI_VERIFIER_ADDRESS=0xf2D374B77db32284D79FCbf72b0d97d16D031cdf
NEXT_PUBLIC_TOPIC_FACTORY_ADDRESS=0xE07fd4CC631b88aD64d3782A7eCDC1D4c8382b70
NEXT_PUBLIC_TOPIC_VAULT_ADDRESS=0xA758c15e87Da64bac82badd9e03F30D7E18d7677
NEXT_PUBLIC_CURATION_MODULE_ADDRESS=0x7dEC25311108Fa879c419b15D74272D81f359170
NEXT_PUBLIC_MESSAGE_REGISTRY_ADDRESS=0xF090c0b7aF977DCf4decab59a5eeDe1514423332
NEXT_PUBLIC_NFT_MINTER_ADDRESS=0xE86E5e51b57D83c4420c78eB1bd30453cA2C0a8F

# Pinata IPFS 配置
PINATA_API_KEY=72ba648f478b3d27ceb6
PINATA_API_SECRET=6e48c9658929eb55abc7dd31990b607d9fe4459e0a35db80abcc2986e0618a0f
PINATA_JWT=eyJhbGc...（完整 JWT）

# AI 服务签名密钥（生成一个新的）
AI_SIGNER_PRIVATE_KEY=0x<your_private_key>
```

**重要**：生成 AI 签名密钥：
```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动（如果端口被占用会自动使用 3001）。

## 📁 项目结构

```
frontend/
├── app/                    # Next.js 页面
│   ├── api/               # API 路由
│   │   ├── ai-score/     # AI 评分服务
│   │   └── ipfs/         # IPFS 上传/获取
│   ├── topics/           # 议题页面
│   ├── assets/          # 资产管理
│   └── gallery/         # NFT 画廊
├── components/            # React 组件
│   ├── ui/              # UI 组件库
│   ├── wallet/          # 钱包组件
│   ├── topic/           # 议题组件
│   └── message/         # 消息组件
├── lib/                  # 库和工具
│   ├── contracts/       # 合约交互
│   ├── wallet/          # 钱包工具
│   ├── ipfs/            # IPFS 工具
│   ├── stores/          # Zustand 状态
│   └── utils/           # 工具函数
└── types/               # TypeScript 类型
```

## 🔧 开发注意事项

### 1. 合约 ABI
当前使用的是占位符 ABI。在生产环境中，需要：
1. 编译合约获取真实的 ABI
2. 将 ABI 文件放入 `lib/contracts/abis/` 目录
3. 更新 `lib/contracts/api.ts` 中的 ABI 引用

### 2. AI 评分
当前 AI 评分使用简单的启发式算法。在生产环境中应该：
1. 集成真实的 AI 模型（如 GPT-4、Claude 等）
2. 实现更复杂的情感和强度分析
3. 添加内容审核功能

### 3. 服务器端渲染 (SSR)
由于 Polkadot 扩展依赖浏览器环境，所有使用 Web3 的组件都需要：
- 标记为 `'use client'`
- 使用动态导入
- 检查 `typeof window !== 'undefined'`

### 4. 性能优化
- IPFS 内容缓存
- 合约调用结果缓存
- 虚拟滚动处理大量消息
- 图片懒加载

## 🌐 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

```bash
npm run build
```

### 自托管部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 📝 常见问题

### Q: "window is not defined" 错误
A: 确保所有使用浏览器 API 的组件都标记为 `'use client'`，并且 Polkadot 库使用动态导入。

### Q: 钱包连接失败
A: 确保已安装 Polkadot 钱包扩展，并且网站有权限访问。

### Q: 合约调用失败
A: 检查：
- RPC 节点是否可访问
- 合约地址是否正确
- 账户是否有足够的余额
- Gas 限制是否足够

### Q: IPFS 上传失败
A: 检查 Pinata 凭证是否正确，API 配额是否充足。

## 🔐 安全考虑

1. **私钥管理**：AI_SIGNER_PRIVATE_KEY 必须保密
2. **环境变量**：永远不要将 `.env.local` 提交到 Git
3. **输入验证**：所有用户输入都应该验证和清理
4. **内容审核**：考虑添加内容过滤和审核机制

## 📚 相关文档

- [使用场景](../docs/useway.md)
- [合约文档](../contracts/CONTRACT_DOCUMENTATION.md)
- [白皮书](../docs/whitepaper.md)

## 🎯 下一步

1. **替换 ABI**：使用真实的编译后的合约 ABI
2. **集成真实 AI**：替换占位符 AI 评分逻辑
3. **添加测试**：编写单元测试和集成测试
4. **性能优化**：实现缓存和懒加载
5. **UI 改进**：根据用户反馈优化界面
6. **移动端适配**：优化移动端体验

## 💡 提示

- 使用 Rococo 测试网进行开发和测试
- 定期备份重要数据
- 监控 Gas 消耗
- 关注 Polkadot 生态更新

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
