import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WalletAccount } from '@/types'

interface WalletStore {
  selectedAccount: WalletAccount | null
  accounts: WalletAccount[]
  isConnected: boolean
  provider: string | null
  setSelectedAccount: (account: WalletAccount | null) => void
  setAccounts: (accounts: WalletAccount[]) => void
  setIsConnected: (isConnected: boolean) => void
  setProvider: (provider: string | null) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      selectedAccount: null,
      accounts: [],
      isConnected: false,
      provider: null,
      setSelectedAccount: (account) => set({ selectedAccount: account }),
      setAccounts: (accounts) => set({ accounts }),
      setIsConnected: (isConnected) => set({ isConnected }),
      setProvider: (provider) => set({ provider }),
      disconnect: () =>
        set({
          selectedAccount: null,
          accounts: [],
          isConnected: false,
          provider: null,
        }),
    }),
    {
      name: 'murmur-wallet-storage',
    }
  )
)
