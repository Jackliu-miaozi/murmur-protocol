import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from './addresses'

// Import ABIs
import VPTokenABI from './abis/VPToken.json'
import TopicFactoryABI from './abis/TopicFactory.json'
import MessageRegistryABI from './abis/MessageRegistry.json'
import CurationModuleABI from './abis/CurationModule.json'
import NFTMinterABI from './abis/NFTMinter.json'
import TopicVaultABI from './abis/TopicVault.json'

const CHAIN_RPC = process.env.NEXT_PUBLIC_CHAIN_RPC || 'wss://rococo-contracts-rpc.polkadot.io'

let provider: ethers.WebSocketProvider | null = null

export function getProvider(): ethers.WebSocketProvider {
  if (provider && provider.readyState === WebSocket.OPEN) {
    return provider
  }

  // Convert wss:// to ws:// for ethers.js if needed, or use http if wss doesn't work
  const rpcUrl = CHAIN_RPC.replace('wss://', 'ws://').replace('https://', 'http://')
  
  provider = new ethers.WebSocketProvider(rpcUrl)
  
  return provider
}

export async function disconnectProvider() {
  if (provider) {
    await provider.destroy()
    provider = null
  }
}

export const ABIS = {
  VPToken: VPTokenABI.abi,
  TopicFactory: TopicFactoryABI.abi,
  MessageRegistry: MessageRegistryABI.abi,
  CurationModule: CurationModuleABI.abi,
  NFTMinter: NFTMinterABI.abi,
  TopicVault: TopicVaultABI.abi,
}

export function getContract(contractName: keyof typeof CONTRACT_ADDRESSES, signer?: ethers.Signer) {
  const provider = getProvider()
  const address = CONTRACT_ADDRESSES[contractName]
  const abi = ABIS[contractName]
  
  if (!abi) {
    throw new Error(`ABI not found for ${contractName}`)
  }

  return new ethers.Contract(address, abi, signer || provider)
}
