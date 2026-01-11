"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { CONTRACTS, ABIS } from "@/lib/contracts";
import type { NFTMetadata } from "@/types";

export function useNFTMinter() {

  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Mint NFTs for a topic
  const mintNfts = async (topicId: bigint) => {
    return writeContractAsync({
      address: CONTRACTS.NFTMinter,
      abi: ABIS.NFTMinter,
      functionName: "mintNfts",
      args: [topicId],
    });
  };

  return {
    isPending,
    mintNfts,
  };
}

// Hook for reading NFT metadata
export function useNFTMetadata(tokenId: bigint | undefined) {
  const {
    data: metadata,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.NFTMinter,
    abi: ABIS.NFTMinter,
    functionName: "getMetadata",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  return {
    metadata: metadata as NFTMetadata | undefined,
    isLoading,
    refetch,
  };
}

// Hook for reading topic to token ID mapping
export function useTopicToTokenId(topicId: bigint | undefined) {
  const {
    data: tokenId,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.NFTMinter,
    abi: ABIS.NFTMinter,
    functionName: "topicToTokenId",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  return {
    tokenId: tokenId as bigint | undefined,
    isLoading,
    refetch,
  };
}

// Hook for reading token URI
export function useTokenURI(tokenId: bigint | undefined) {
  const {
    data: uri,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.NFTMinter,
    abi: ABIS.NFTMinter,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  return {
    uri: uri as string | undefined,
    isLoading,
    refetch,
  };
}

// Hook for checking NFT ownership
export function useNFTOwner(tokenId: bigint | undefined) {
  const { data: owner, isLoading } = useReadContract({
    address: CONTRACTS.NFTMinter,
    abi: ABIS.NFTMinter,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  return {
    owner: owner as `0x${string}` | undefined,
    isLoading,
  };
}
