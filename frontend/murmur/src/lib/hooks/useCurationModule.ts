"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { CONTRACTS, ABIS } from "@/lib/contracts";

export function useCurationModule() {
  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Finalize curated messages
  const finalizeCuratedMessages = async (topicId: bigint) => {
    return writeContractAsync({
      address: CONTRACTS.CurationModule,
      abi: ABIS.CurationModule,
      functionName: "finalizeCuratedMessages",
      args: [topicId],
    });
  };

  return {
    isPending,
    finalizeCuratedMessages,
  };
}

// Hook for reading curated messages
export function useCuratedMessages(topicId: bigint | undefined) {
  const {
    data: messageIds,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.CurationModule,
    abi: ABIS.CurationModule,
    functionName: "getCuratedMessages",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    messageIds: messageIds as bigint[] | undefined,
    isLoading,
    refetch,
  };
}

// Hook for reading curated set hash
export function useCuratedSetHash(topicId: bigint | undefined) {
  const {
    data: hash,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.CurationModule,
    abi: ABIS.CurationModule,
    functionName: "curatedSetHash",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    hash: hash as `0x${string}` | undefined,
    isLoading,
    refetch,
  };
}

// Hook for checking if curated messages are finalized
export function useIsFinalized(topicId: bigint | undefined) {
  const { data: isFinalized, isLoading } = useReadContract({
    address: CONTRACTS.CurationModule,
    abi: ABIS.CurationModule,
    functionName: "finalized",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    isFinalized: isFinalized as boolean | undefined,
    isLoading,
  };
}
