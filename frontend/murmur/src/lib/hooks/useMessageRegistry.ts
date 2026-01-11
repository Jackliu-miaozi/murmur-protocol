"use client";

import { useReadContract, useWriteContract, usePublicClient, useAccount } from "wagmi";
import { formatEther, keccak256, toBytes } from "viem";
import { CONTRACTS, ABIS } from "@/lib/contracts";
import type { Message } from "@/types";

// Helper to extract detailed error from viem errors
function extractRevertReason(error: unknown): string | null {
  if (error instanceof Error) {
    const errorString = error.toString();
    const errorMessage = error.message || errorString;
    
    // Try multiple patterns to extract revert reason
    const patterns = [
      /revert\s+(.+?)(?:\n|$)/i,
      /execution reverted:\s*(.+?)(?:\n|$)/i,
      /reverted with reason string '(.+?)'/i,
      /reverted with reason '(.+?)'/i,
      /reverted:\s*(.+?)(?:\n|$)/i,
      /reason:\s*(.+?)(?:\n|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Check for common error messages in the full error
    if (errorMessage.includes("invalid AI signature")) {
      return "MessageRegistry: invalid AI signature";
    }
    if (errorMessage.includes("topic not live")) {
      return "MessageRegistry: topic not live";
    }
    if (errorMessage.includes("insufficient VP")) {
      return "MessageRegistry: insufficient VP";
    }
    if (errorMessage.includes("invalid timestamp")) {
      return "AIScoreVerifier: invalid timestamp";
    }
  }
  
  return null;
}

export function useMessageRegistry() {
  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  // Post message with simulation for better error messages
  const postMessage = async (
    topicId: bigint,
    contentHash: `0x${string}`,
    length: bigint,
    aiScore: bigint,
    timestamp: bigint,
    signature: `0x${string}`,
  ) => {
    // First, simulate the contract call to get detailed error messages
    if (publicClient && address) {
      try {
        console.log("🔍 Simulating contract call...");
        console.log("   Args:", {
          topicId: topicId.toString(),
          contentHash,
          length: length.toString(),
          aiScore: aiScore.toString(),
          timestamp: timestamp.toString(),
          signature: signature.slice(0, 20) + "...",
        });
        
        const result = await publicClient.simulateContract({
          address: CONTRACTS.MessageRegistry,
          abi: ABIS.MessageRegistry,
          functionName: "postMessage",
          args: [topicId, contentHash, length, aiScore, timestamp, signature],
          account: address,
        });
        
        console.log("✅ Simulation passed");
        console.log("   Result:", result);
      } catch (simError: unknown) {
        console.error("❌ Simulation failed:", simError);
        const revertReason = extractRevertReason(simError);
        if (revertReason) {
          console.error("   Revert reason:", revertReason);
          throw new Error(`合约调用将失败: ${revertReason}`);
        }
        throw simError;
      }
    }

    // If simulation passes, proceed with actual transaction
    try {
      return await writeContractAsync({
        address: CONTRACTS.MessageRegistry,
        abi: ABIS.MessageRegistry,
        functionName: "postMessage",
        args: [topicId, contentHash, length, aiScore, timestamp, signature],
      });
    } catch (txError: unknown) {
      console.error("❌ Transaction failed:", txError);
      const revertReason = extractRevertReason(txError);
      if (revertReason) {
        throw new Error(`交易失败: ${revertReason}`);
      }
      throw txError;
    }
  };

  // Like message
  const likeMessage = async (topicId: bigint, messageId: bigint) => {
    return writeContractAsync({
      address: CONTRACTS.MessageRegistry,
      abi: ABIS.MessageRegistry,
      functionName: "likeMessage",
      args: [topicId, messageId],
    });
  };

  // Helper: Create content hash from IPFS hash
  const createContentHash = (ipfsHash: string): `0x${string}` => {
    return keccak256(toBytes(ipfsHash));
  };

  return {
    // Loading states
    isPending,

    // Functions
    postMessage,
    likeMessage,
    createContentHash,
  };
}

// Hook for reading messages by topic
export function useTopicMessages(
  topicId: bigint | undefined,
  offset = 0n,
  limit = 50n,
) {
  const {
    data: messages,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.MessageRegistry,
    abi: ABIS.MessageRegistry,
    functionName: "getMessagesByTopic",
    args: topicId !== undefined ? [topicId, offset, limit] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    messages: messages as Message[] | undefined,
    isLoading,
    refetch,
  };
}

// Hook for reading message count
export function useMessageCount(topicId: bigint | undefined) {
  const {
    data: count,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.MessageRegistry,
    abi: ABIS.MessageRegistry,
    functionName: "getMessageCount",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    count: count as bigint | undefined,
    isLoading,
    refetch,
  };
}

// Hook for reading single message
export function useMessage(messageId: bigint | undefined) {
  const {
    data: message,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.MessageRegistry,
    abi: ABIS.MessageRegistry,
    functionName: "getMessage",
    args: messageId !== undefined ? [messageId] : undefined,
    query: {
      enabled: messageId !== undefined,
    },
  });

  return {
    message: message as Message | undefined,
    isLoading,
    refetch,
  };
}

// Hook for checking if user has posted in topic
export function useHasUserPostedInTopic(
  topicId: bigint | undefined,
  user: `0x${string}` | undefined,
) {
  const { data: hasPosted, isLoading } = useReadContract({
    address: CONTRACTS.MessageRegistry,
    abi: ABIS.MessageRegistry,
    functionName: "hasUserPostedInTopic",
    args: topicId !== undefined && user ? [topicId, user] : undefined,
    query: {
      enabled: topicId !== undefined && !!user,
    },
  });

  return {
    hasPosted: hasPosted as boolean | undefined,
    isLoading,
  };
}

// Hook for calculating message cost
export function useMessageCost(
  topicId: bigint | undefined,
  length: bigint,
  aiScore: bigint,
) {
  const {
    data: cost,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.MessageRegistry,
    abi: ABIS.MessageRegistry,
    functionName: "calculateMessageCost",
    args:
      topicId !== undefined ? [topicId, length, aiScore] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    cost: cost ? formatEther(cost as bigint) : "0",
    costRaw: cost as bigint | undefined,
    isLoading,
    refetch,
  };
}
