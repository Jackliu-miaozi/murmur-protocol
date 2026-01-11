"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { formatEther, keccak256, toBytes } from "viem";
import { CONTRACTS, ABIS } from "@/lib/contracts";
import type { Topic } from "@/types";

export function useTopicFactory() {

  // Read topic counter
  const {
    data: topicCounter,
    isLoading: isLoadingCounter,
    refetch: refetchCounter,
  } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "topicCounter",
  });

  // Read active topic count
  const {
    data: activeTopicCount,
    isLoading: isLoadingActiveCount,
    refetch: refetchActiveCount,
  } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "activeTopicCount",
  });

  // Read creation cost
  const {
    data: creationCost,
    isLoading: isLoadingCost,
    refetch: refetchCost,
  } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "quoteCreationCost",
  });

  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Get topic by ID
  const useTopic = (topicId: bigint | undefined) => {
    const {
      data: topic,
      isLoading,
      refetch,
    } = useReadContract({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "getTopic",
      args: topicId !== undefined ? [topicId] : undefined,
      query: {
        enabled: topicId !== undefined,
      },
    });

    return {
      topic: topic as Topic | undefined,
      isLoading,
      refetch,
    };
  };

  // Check if topic is frozen
  const useIsFrozen = (topicId: bigint | undefined) => {
    const { data: isFrozen, isLoading } = useReadContract({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "isFrozen",
      args: topicId !== undefined ? [topicId] : undefined,
      query: {
        enabled: topicId !== undefined,
      },
    });

    return { isFrozen: isFrozen as boolean | undefined, isLoading };
  };

  // Check if topic is expired
  const useIsExpired = (topicId: bigint | undefined) => {
    const { data: isExpired, isLoading } = useReadContract({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "isExpired",
      args: topicId !== undefined ? [topicId] : undefined,
      query: {
        enabled: topicId !== undefined,
      },
    });

    return { isExpired: isExpired as boolean | undefined, isLoading };
  };

  // Create topic
  const createTopic = async (
    metadataHash: `0x${string}`,
    durationSeconds: bigint,
    freezeWindowSeconds: bigint,
    curatedLimit: bigint,
  ) => {
    const result = await writeContractAsync({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "createTopic",
      args: [metadataHash, durationSeconds, freezeWindowSeconds, curatedLimit],
    });

    await Promise.all([refetchCounter(), refetchActiveCount(), refetchCost()]);

    return result;
  };

  // Close topic
  const closeTopic = async (topicId: bigint) => {
    return writeContractAsync({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "closeTopic",
      args: [topicId],
    });
  };

  // Check and close topic if expired
  const checkAndCloseTopic = async (topicId: bigint) => {
    return writeContractAsync({
      address: CONTRACTS.TopicFactory,
      abi: ABIS.TopicFactory,
      functionName: "checkAndCloseTopic",
      args: [topicId],
    });
  };

  // Helper: Create metadata hash from IPFS hash
  const createMetadataHash = (ipfsHash: string): `0x${string}` => {
    return keccak256(toBytes(ipfsHash));
  };

  return {
    // Data
    topicCounter: topicCounter as bigint | undefined,
    activeTopicCount: activeTopicCount as bigint | undefined,
    creationCost: creationCost ? formatEther(creationCost as bigint) : "0",
    creationCostRaw: creationCost as bigint | undefined,

    // Loading states
    isLoading: isLoadingCounter || isLoadingActiveCount || isLoadingCost,
    isPending,

    // Hook functions (for use within components)
    useTopic,
    useIsFrozen,
    useIsExpired,

    // Functions
    createTopic,
    closeTopic,
    checkAndCloseTopic,
    createMetadataHash,
    refetchCounter,
    refetchActiveCount,
    refetchCost,
  };
}

// Separate hook for reading single topic (to allow multiple calls)
export function useTopic(topicId: bigint | undefined) {
  const {
    data: topic,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "getTopic",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    topic: topic as Topic | undefined,
    isLoading,
    refetch,
  };
}
