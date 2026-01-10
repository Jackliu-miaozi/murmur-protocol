import { ethers } from 'ethers'
import { getContract } from './api'
import type { WalletAccount, NFTMetadata } from '@/types'

export class NFTMinterContract {
  async mintNfts(topicId: number, signer: ethers.Signer): Promise<string> {
    const contract = getContract('NFTMinter', signer)
    
    const tx = await contract.mintNfts(topicId)
    await tx.wait()
    
    return tx.hash
  }

  async getMetadata(tokenId: number): Promise<NFTMetadata | null> {
    const contract = getContract('NFTMinter')
    
    try {
      const metadata = await contract.getMetadata(tokenId)
      
      return {
        tokenId,
        topicId: Number(metadata.topicId),
        topicHash: metadata.topicHash,
        curatedHash: metadata.curatedHash,
        version: Number(metadata.version),
        mintedAt: Number(metadata.mintedAt),
        mintedBy: metadata.mintedBy,
      }
    } catch (error) {
      console.error('Failed to get NFT metadata:', error)
      return null
    }
  }
}

export const nftMinterContract = new NFTMinterContract()
