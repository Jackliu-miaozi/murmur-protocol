import type { WalletAccount, WalletProvider } from '@/types'

const APP_NAME = 'Murmur Protocol'

export const WALLET_PROVIDERS: WalletProvider[] = [
  {
    name: 'polkadot-js',
    icon: '🔵',
    installed: false,
  },
  {
    name: 'subwallet-js',
    icon: '🟣',
    installed: false,
  },
  {
    name: 'talisman',
    icon: '🔴',
    installed: false,
  },
]

// Dynamically import polkadot extension to avoid SSR issues
async function getPolkadotExtension() {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in browser')
  }
  
  const { web3Accounts, web3Enable, web3FromAddress } = await import('@polkadot/extension-dapp')
  return { web3Accounts, web3Enable, web3FromAddress }
}

export async function checkWalletInstallation(): Promise<WalletProvider[]> {
  if (typeof window === 'undefined') return WALLET_PROVIDERS

  try {
    const { web3Enable } = await getPolkadotExtension()
    const extensions = await web3Enable(APP_NAME)
    
    return WALLET_PROVIDERS.map(provider => ({
      ...provider,
      installed: extensions.some(ext => ext.name === provider.name),
    }))
  } catch (error) {
    console.error('Failed to check wallet installation:', error)
    return WALLET_PROVIDERS
  }
}

export async function connectWallet(providerName?: string): Promise<WalletAccount[]> {
  const { web3Enable, web3Accounts } = await getPolkadotExtension()

  // Enable the extension
  const extensions = await web3Enable(APP_NAME)
  
  if (extensions.length === 0) {
    throw new Error('No Polkadot extension installed')
  }

  // Filter by provider if specified
  let targetExtensions = extensions
  if (providerName) {
    targetExtensions = extensions.filter(ext => ext.name === providerName)
    if (targetExtensions.length === 0) {
      throw new Error(`Wallet ${providerName} not found`)
    }
  }

  // Get all accounts from all enabled extensions
  const allAccounts = await web3Accounts()
  
  // Filter accounts by provider if specified
  let accounts = allAccounts
  if (providerName) {
    accounts = allAccounts.filter(acc => acc.meta.source === providerName)
  }

  if (accounts.length === 0) {
    throw new Error('No accounts found')
  }

  return accounts.map(acc => ({
    address: acc.address,
    meta: {
      name: acc.meta.name,
      source: acc.meta.source,
    },
  }))
}

export async function signMessage(address: string, message: string): Promise<{ signature: string }> {
  const { web3FromAddress } = await getPolkadotExtension()
  const injector = await web3FromAddress(address)
  
  if (!injector.signer.signRaw) {
    throw new Error('Wallet does not support message signing')
  }

  const result = await injector.signer.signRaw({
    address,
    data: message,
    type: 'bytes',
  })

  return { signature: result.signature }
}

export async function getInjector(address: string) {
  const { web3FromAddress } = await getPolkadotExtension()
  return await web3FromAddress(address)
}
