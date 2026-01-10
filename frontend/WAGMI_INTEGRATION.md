# Wagmi Integration for Local Chain

## 已完成的更新

### 1. 安装依赖
- wagmi - React Hooks for Ethereum
- viem - TypeScript Interface for Ethereum
- @tanstack/react-query - Async state management

### 2. Wagmi 配置
- 配置文件：`lib/wagmi/config.ts`
- 支持本地链（localhost:8545）
- 支持多种钱包连接器（Injected, MetaMask）

### 3. Provider 设置
- Web3Provider 包装了 WagmiProvider 和 QueryClientProvider
- 在 `app/layout.tsx` 中全局注册

### 4. 自定义 Hooks
创建了以下合约交互 hooks：

#### VPToken Hooks (`lib/hooks/useVPToken.ts`)
- `useVPBalance(address)` - 查询 VP 余额
- `useStakedVdot(address)` - 查询质押的 vDOT
- `useStakeVdot()` - 质押 vDOT
- `useWithdrawVdot()` - 提取 vDOT

#### TopicFactory Hooks (`lib/hooks/useTopicFactory.ts`)
- `useQuoteCreationCost()` - 查询创建成本
- `useGetTopic(topicId)` - 查询议题信息
- `useCreateTopic()` - 创建议题

#### MessageRegistry Hooks (`lib/hooks/useMessageRegistry.ts`)
- `useGetMessage(messageId)` - 查询单条消息
- `useGetMessagesByTopic(topicId, offset, limit)` - 查询议题消息列表
- `usePostMessage()` - 发布消息
- `useLikeMessage()` - 点赞消息

#### NFTMinter Hooks (`lib/hooks/useNFTMinter.ts`)
- `useGetNFTMetadata(tokenId)` - 查询 NFT 元数据
- `useMintNFT()` - 铸造 NFT

### 5. 更新的组件
- `WalletButton.tsx` - 使用 wagmi 的 useAccount, useConnect, useDisconnect
- `MessageComposer.tsx` - 使用 usePostMessage hook
- `MessageList.tsx` - 使用 useGetMessagesByTopic 和 useLikeMessage
- `CuratedMessages.tsx` - 使用 useGetMessagesByTopic
- `TopicList.tsx` - 使用 wagmi hooks
- `app/assets/page.tsx` - 完整的资产管理界面

## 配置本地链

### 1. 启动本地节点

确保你的本地 EVM 节点运行在 `http://127.0.0.1:8545`

使用 Hardhat：
```bash
cd contracts
npx hardhat node
```

### 2. 更新链 ID（如需要）

如果你的本地链使用不同的 Chain ID，更新 `lib/wagmi/config.ts`：

```typescript
const localChain = {
  ...localhost,
  id: 1337, // 改为你的链 ID
  // ...
}
```

### 3. 连接 MetaMask 到本地链

1. 打开 MetaMask
2. 添加网络
3. 配置：
   - 网络名称：Localhost
   - RPC URL：http://127.0.0.1:8545
   - Chain ID：1337（或你的链 ID）
   - 货币符号：ETH

### 4. 导入测试账户

从本地节点获取测试账户私钥并导入到 MetaMask。

## 使用示例

### 读取合约数据

```typescript
import { useVPBalance } from '@/lib/hooks/useVPToken'
import { useAccount } from 'wagmi'

function Component() {
  const { address } = useAccount()
  const { data: balance, isLoading } = useVPBalance(address)
  
  return <div>VP Balance: {balance?.toString()}</div>
}
```

### 写入合约数据

```typescript
import { useStakeVdot } from '@/lib/hooks/useVPToken'

function Component() {
  const { stake, isLoading, isSuccess } = useStakeVdot()
  
  const handleStake = () => {
    stake(BigInt(1000e18)) // Stake 1000 vDOT
  }
  
  return (
    <button onClick={handleStake} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Stake'}
    </button>
  )
}
```

### 等待交易确认

```typescript
import { useStakeVdot } from '@/lib/hooks/useVPToken'
import { useEffect } from 'react'

function Component() {
  const { stake, isSuccess, hash } = useStakeVdot()
  
  useEffect(() => {
    if (isSuccess) {
      console.log('Transaction successful:', hash)
      // Refetch data or show success message
    }
  }, [isSuccess, hash])
  
  // ...
}
```

## Wagmi vs 之前的实现

### 之前（Polkadot API）
```typescript
const contract = await getContract('VPToken')
const balance = await contract.balanceOf(address)
```

### 现在（Wagmi）
```typescript
const { data: balance } = useVPBalance(address)
```

### 优势
1. **自动缓存**：Wagmi 使用 React Query，自动处理缓存
2. **实时更新**：自动监听区块链状态变化
3. **类型安全**：完整的 TypeScript 支持
4. **错误处理**：统一的错误处理机制
5. **加载状态**：内置 loading 和 success 状态
6. **重试机制**：自动重试失败的请求

## 环境变量

`.env.local` 不需要更改，但确保以下变量正确：

```env
# 合约地址（确保是你本地部署的地址）
NEXT_PUBLIC_VPTOKEN_ADDRESS=0x...
NEXT_PUBLIC_TOPIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_MESSAGE_REGISTRY_ADDRESS=0x...
# ... 其他合约地址

# IPFS 和 AI 服务保持不变
PINATA_API_KEY=...
PINATA_API_SECRET=...
AI_SIGNER_PRIVATE_KEY=...
```

## 测试步骤

1. **启动本地链**
   ```bash
   cd contracts
   npx hardhat node
   ```

2. **部署合约**
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. **更新合约地址**
   将部署后的地址更新到 `frontend/lib/contracts/addresses.ts`

4. **启动前端**
   ```bash
   cd frontend
   npm run dev
   ```

5. **连接钱包**
   - 打开 http://localhost:3000
   - 点击 "Connect Wallet"
   - 选择 MetaMask
   - 确保 MetaMask 连接到本地网络

6. **测试功能**
   - 质押 vDOT
   - 创建议题
   - 发送消息
   - 点赞

## 常见问题

### Q: "Chain ID mismatch" 错误
A: 确保 MetaMask 连接的链 ID 与 `lib/wagmi/config.ts` 中配置的一致。

### Q: 交易失败
A: 检查：
- 账户是否有足够的 ETH（Gas费）
- 合约地址是否正确
- 合约是否已部署
- ABI 是否匹配

### Q: 连接不上钱包
A: 确保：
- MetaMask 已安装
- 允许网站访问 MetaMask
- MetaMask 已解锁

### Q: 数据不更新
A: Wagmi 有自动缓存机制，可以手动调用 `refetch()` 刷新数据。

## 下一步

1. 测试所有合约交互功能
2. 添加错误提示和用户反馈
3. 优化加载状态显示
4. 添加交易历史记录
5. 实现更多高级功能
