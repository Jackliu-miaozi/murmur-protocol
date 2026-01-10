import { ethers } from 'ethers'
import { getContract } from './api'
import type { WalletAccount, Topic } from '@/types'

export class TopicFactoryContract {
  async createTopic(
    metadataHash: string,
    duration: number,
    freezeWindow: number,
    curatedLimit: number,
    signer: ethers.Signer
  ): Promise<string> {
    const contract = getContract('TopicFactory', signer)
    
    const tx = await contract.createTopic(
      metadataHash,
      duration,
      freezeWindow,
      curatedLimit
    )
    await tx.wait()
    
    return tx.hash
  }

  async quoteCreationCost(): Promise<bigint> {
    const contract = getContract('TopicFactory')
    const cost = await contract.quoteCreationCost()
    return BigInt(cost.toString())
  }

  async getTopic(topicId: number): Promise<Topic | null> {
    const contract = getContract('TopicFactory')
    
    try {
      const topicData = await contract.getTopic(topicId)
      
      return {
        id: topicId,
        creator: topicData.creator,
        metadataHash: topicData.metadataHash,
        startTime: Number(topicData.startTime),
        endTime: Number(topicData.endTime),
        freezeWindow: Number(topicData.freezeWindow),
        curatedLimit: Number(topicData.curatedLimit),
        status: Number(topicData.status),
        messageCount: 0, // Will be fetched separately
        participantCount: 0, // Will be fetched separately
      }
    } catch (error) {
      console.error('Failed to get topic:', error)
      return null
    }
  }
}

export const topicFactoryContract = new TopicFactoryContract()
