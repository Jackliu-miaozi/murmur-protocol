import { ethers } from 'ethers'
import { getContract } from './api'
import type { WalletAccount } from '@/types'

export class VPTokenContract {
  async stakeVdot(amount: bigint, account: WalletAccount, signer: ethers.Signer): Promise<string> {
    const contract = getContract('VPToken', signer)
    
    const tx = await contract.stakeVdot(amount)
    await tx.wait()
    
    return tx.hash
  }

  async withdrawVdot(amount: bigint, account: WalletAccount, signer: ethers.Signer): Promise<string> {
    const contract = getContract('VPToken', signer)
    
    const tx = await contract.withdrawVdot(amount)
    await tx.wait()
    
    return tx.hash
  }

  async balanceOf(userAddress: string): Promise<bigint> {
    const contract = getContract('VPToken')
    const balance = await contract.balanceOf(userAddress)
    return BigInt(balance.toString())
  }
}

export const vpTokenContract = new VPTokenContract()
