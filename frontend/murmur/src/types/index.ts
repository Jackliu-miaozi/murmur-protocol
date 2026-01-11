import type { TopicStatus } from "@/lib/contracts";

// Topic metadata stored in IPFS
export interface TopicMetadata {
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  tags?: string[];
}

// Topic from contract
export interface Topic {
  topicId: bigint;
  creator: `0x${string}`;
  metadataHash: `0x${string}`;
  createdAt: bigint;
  duration: bigint;
  freezeWindow: bigint;
  curatedLimit: bigint;
  status: TopicStatus;
  minted: boolean;
}

// Message metadata stored in IPFS
export interface MessageContent {
  content: string;
  author: string;
  timestamp: number;
}

// Message from contract
export interface Message {
  messageId: bigint;
  topicId: bigint;
  author: `0x${string}`;
  contentHash: `0x${string}`;
  length: bigint;
  aiScore: bigint;
  timestamp: bigint;
  likeCount: bigint;
  vpCost: bigint;
}

// NFT metadata from contract
export interface NFTMetadata {
  topicId: bigint;
  topicHash: `0x${string}`;
  curatedHash: `0x${string}`;
  version: string;
  mintedAt: bigint;
  mintedBy: `0x${string}`;
}

// Topic with metadata for display
export interface TopicWithMetadata extends Topic {
  metadata?: TopicMetadata;
  messageCount?: number;
  remainingTime?: number;
}

// Message with content for display
export interface MessageWithContent extends Message {
  content?: MessageContent;
  isCurated?: boolean;
}

// Form data for creating topic
export interface CreateTopicForm {
  title: string;
  description: string;
  duration: number; // in hours
  freezeWindow: number; // in minutes
  curatedLimit: number;
}

// Form data for posting message
export interface PostMessageForm {
  content: string;
  aiScore?: number;
}
