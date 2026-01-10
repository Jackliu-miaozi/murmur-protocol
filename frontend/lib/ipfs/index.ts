import axios from 'axios'
import type { TopicMetadata, MessageContent, IPFSUploadResponse } from '@/types'

const PINATA_API_KEY = process.env.PINATA_API_KEY!
const PINATA_API_SECRET = process.env.PINATA_API_SECRET!
const PINATA_JWT = process.env.PINATA_JWT!

const pinataApi = axios.create({
  baseURL: 'https://api.pinata.cloud',
  headers: {
    'Authorization': `Bearer ${PINATA_JWT}`,
  },
})

export async function uploadToIPFS(data: any, name?: string): Promise<IPFSUploadResponse> {
  try {
    const response = await pinataApi.post('/pinning/pinJSONToIPFS', {
      pinataContent: data,
      pinataMetadata: {
        name: name || `murmur-${Date.now()}`,
      },
    })

    return {
      hash: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp,
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    throw new Error('Failed to upload to IPFS')
  }
}

export async function uploadTopicMetadata(metadata: TopicMetadata): Promise<string> {
  const result = await uploadToIPFS(metadata, `topic-${metadata.createdAt}`)
  return result.hash
}

export async function uploadMessageContent(content: MessageContent): Promise<string> {
  const result = await uploadToIPFS(content, `message-${content.timestamp}`)
  return result.hash
}

export async function getFromIPFS<T = any>(hash: string): Promise<T> {
  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${hash}`)
    return response.data
  } catch (error) {
    console.error('IPFS fetch error:', error)
    throw new Error('Failed to fetch from IPFS')
  }
}

export function generateContentHash(ipfsHash: string): string {
  // Convert IPFS hash to bytes32 format for smart contract
  // This is a simplified version - in production, use proper IPFS hash conversion
  const encoder = new TextEncoder()
  const data = encoder.encode(ipfsHash)
  const hex = Array.from(data)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64)
  return '0x' + hex
}
