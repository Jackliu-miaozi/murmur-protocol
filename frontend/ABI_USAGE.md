# ABI 使用说明

## ✅ 已完成的更新

1. **ABI 文件已复制**：从 `contracts/artifacts-pvm/contracts/` 复制到 `frontend/lib/contracts/abis/`
   - VPToken.json
   - TopicFactory.json
   - MessageRegistry.json
   - CurationModule.json
   - NFTMinter.json
   - TopicVault.json

2. **合约交互代码已更新**：从 Polkadot API 改为 ethers.js
   - `lib/contracts/api.ts` - 使用 ethers.js 和真实 ABI
   - `lib/contracts/vpToken.ts` - 更新为 ethers.js
   - `lib/contracts/topicFactory.ts` - 更新为 ethers.js
   - `lib/contracts/messageRegistry.ts` - 更新为 ethers.js
   - `lib/contracts/nftMinter.ts` - 更新为 ethers.js

## ⚠️ 重要注意事项

### 合约类型
这些是 **Solidity 合约**（EVM 格式），不是 ink! 合约。因此：
- ✅ 使用 `ethers.js` 而不是 `@polkadot/api-contract`
- ✅ ABI 格式是标准的 Solidity ABI JSON
- ⚠️ 需要 EVM 兼容的钱包（如 MetaMask）或特殊的 Polkadot-EVM 桥接

### 钱包集成

当前代码支持两种方式：

1. **EVM 钱包**（推荐，如果部署在 EVM 兼容链上）：
   - MetaMask
   - WalletConnect
   - 其他标准 EVM 钱包

2. **Polkadot 钱包**（需要桥接）：
   - 如果合约部署在原生 Substrate 链上
   - 需要实现 Polkadot 账户到 EVM 地址的转换
   - 可能需要使用特殊的签名适配器

### 部署链确认

请确认合约部署在哪个链上：

- **如果部署在 Moonbeam/Astar 等 EVM 兼容链**：
  - 使用 MetaMask 连接
  - 使用标准的 ethers.js Provider
  - 更新 RPC 为对应的 EVM RPC（如 `https://rpc.api.moonbeam.network`）

- **如果部署在 Rococo Contracts Chain**：
  - 可能需要特殊的 Provider 配置
  - 需要确认是否支持 EVM 兼容模式
  - 可能需要使用 `@polkadot/api` 的特殊适配器

## 🔧 需要完成的步骤

### 1. 更新钱包连接

更新 `components/wallet/WalletButton.tsx` 以支持 EVM 钱包：

```typescript
// 添加 MetaMask 支持
if (typeof window !== 'undefined' && (window as any).ethereum) {
  // 连接 MetaMask
  const provider = new ethers.BrowserProvider((window as any).ethereum)
  const signer = await provider.getSigner()
  // 使用 signer 进行交易
}
```

### 2. 更新所有合约调用

所有需要签名的合约调用都需要传入 `ethers.Signer`：

```typescript
// 之前（Polkadot）
await vpTokenContract.stakeVdot(amount, account)

// 现在（ethers.js）
const signer = await createEthersSigner(account)
await vpTokenContract.stakeVdot(amount, account, signer)
```

### 3. 更新组件

更新以下组件以使用新的合约接口：
- `components/message/MessageComposer.tsx`
- `components/message/MessageList.tsx`
- `app/assets/page.tsx`
- `app/topics/[id]/page.tsx`
- 其他使用合约的组件

### 4. 测试合约交互

1. 测试读取操作（不需要签名）：
   - `balanceOf()`
   - `getTopic()`
   - `getMessage()`

2. 测试写入操作（需要签名）：
   - `stakeVdot()`
   - `createTopic()`
   - `postMessage()`
   - `likeMessage()`

## 📝 示例代码

### 使用 ethers.js 读取合约

```typescript
import { getContract } from '@/lib/contracts/api'

const contract = getContract('VPToken')
const balance = await contract.balanceOf(userAddress)
```

### 使用 ethers.js 写入合约

```typescript
import { getContract } from '@/lib/contracts/api'
import { createEthersSigner } from '@/lib/wallet/ethersAdapter'

const signer = await createEthersSigner(account)
const contract = getContract('VPToken', signer)
const tx = await contract.stakeVdot(amount)
await tx.wait()
```

## 🚨 已知问题

1. **Provider 配置**：当前使用 WebSocketProvider，可能需要根据实际 RPC 调整
2. **钱包适配**：Polkadot 钱包到 EVM signer 的转换需要实现
3. **错误处理**：需要添加更完善的错误处理和用户提示

## 📚 参考

- [ethers.js 文档](https://docs.ethers.org/)
- [Solidity ABI 规范](https://docs.soliditylang.org/en/latest/abi-spec.html)
- [Polkadot EVM 兼容性](https://docs.moonbeam.network/)
