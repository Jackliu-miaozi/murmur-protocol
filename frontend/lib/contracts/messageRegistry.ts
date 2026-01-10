import { ethers } from 'ethers'
import { getContract } from './api'
import type { WalletAccount, Message } from '@/types'

export class MessageRegistryContract {
  async postMessage(
    topicId: number,
    contentHash: string,
    length: number,
    aiScore: bigint,
    timestamp: number,
    signature: string,
    signer: ethers.Signer
  ): Promise<string> {
    const contract = getContract('MessageRegistry', signer)
    
    const tx = await contract.postMessage(
      topicId,
      contentHash,
      length,
      aiScore,
      timestamp,
      signature
    )
    await tx.wait()
    
    return tx.hash
  }

  async likeMessage(
    topicId: number,
    messageId: number,
    signer: ethers.Signer
  ): Promise<string> {
    const contract = getContract('MessageRegistry', signer)
    
    const tx = await contract.likeMessage(topicId, messageId)
    await tx.wait()
    
    return tx.hash
  }

  async getMessage(messageId: number): Promise<Message | null> {
    const contract = getContract('MessageRegistry')
    
    try {
      const messageData = await contract.getMessage(messageId)
      
      return {
        id: messageId,
        topicId: Number(messageData.topicId),
        author: messageData.author,
        contentHash: messageData.contentHash,
        timestamp: Number(messageData.timestamp),
        likeCount: Number(messageData.likeCount || 0),
        vpCost: BigInt(messageData.vpCost?.toString() || '0'),
        aiScore: Number(messageData.aiScore || 0) / 1e18,
        length: Number(messageData.length || 0),
      }
    } catch (error) {
      console.error('Failed to get message:', error)
      return null
    }
  }

  async getMessagesByTopic(
    topicId: number,
    offset: number,
    limit: number
  ): Promise<Message[]> {
    const contract = getContract('MessageRegistry')
    
    try {
      const messages = await contract.getMessagesByTopic(topicId, offset, limit)
      
      return messages.map((msg: any, idx: number) => ({
        id: offset + idx,
        topicId: Number(msg.topicId),
        author: msg.author,
        contentHash: msg.contentHash,
        timestamp: Number(msg.timestamp),
        likeCount: Number(msg.likeCount || 0),
        vpCost: BigInt(msg.vpCost?.toString() || '0'),
        aiScore: Number(msg.aiScore || 0) / 1e18,
        length: Number(msg.length || 0),
      }))
    } catch (error) {
      console.error('Failed to get messages:', error)
      return []
    }
  }
}

export const messageRegistryContract = new MessageRegistryContract()
