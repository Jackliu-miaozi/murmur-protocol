// Contract types
export interface Topic {
  id: number
  creator: string
  metadataHash: string
  startTime: number
  endTime: number
  freezeWindow: number
  curatedLimit: number
  status: TopicStatus
  messageCount: number
  participantCount: number
}

export enum TopicStatus {
  Draft = 0,
  Live = 1,
  Closed = 2,
  Minted = 3,
  Settled = 4,
}

export interface Message {
  id: number
  topicId: number
  author: string
  contentHash: string
  timestamp: number
  likeCount: number
  vpCost: bigint
  aiScore: number
  length: number
}

export interface NFTMetadata {
  tokenId: number
  topicId: number
  topicHash: string
  curatedHash: string
  version: number
  mintedAt: number
  mintedBy: string
}

// Wallet types
export interface WalletAccount {
  address: string
  meta: {
    name?: string
    source: string
  }
}

export interface WalletProvider {
  name: string
  icon: string
  installed: boolean
}

// AI Service types
export interface AIScoreRequest {
  content: string
  length: number
}

export interface AIScoreResponse {
  score: number // 0-1 scaled to 1e18
  timestamp: number
  signature: string
}

// IPFS types
export interface IPFSUploadResponse {
  hash: string
  pinSize: number
  timestamp: string
}

export interface TopicMetadata {
  title: string
  description: string
  creator: string
  createdAt: number
}

export interface MessageContent {
  text: string
  author: string
  timestamp: number
}

// Store types
export interface WalletState {
  selectedAccount: WalletAccount | null
  accounts: WalletAccount[]
  isConnected: boolean
  provider: string | null
}

export interface VPState {
  globalVP: bigint
  vdotBalance: bigint
  topicVPBalances: Map<number, bigint>
}
