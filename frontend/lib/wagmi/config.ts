import { http, createConfig } from 'wagmi'
import { localhost } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// 配置本地链
const localChain = {
  ...localhost,
  id: 1337, // 本地链 ID，可根据实际情况修改
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
}

// 创建 wagmi 配置
export const config = createConfig({
  chains: [localChain],
  connectors: [
    injected(),
    metaMask(),
    // 如果需要 WalletConnect，取消注释并添加 projectId
    // walletConnect({ 
    //   projectId: 'YOUR_PROJECT_ID',
    // }),
  ],
  transports: {
    [localChain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
