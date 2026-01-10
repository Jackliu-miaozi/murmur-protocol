import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../contracts/addresses'
import NFTMinterABI from '../contracts/abis/NFTMinter.json'

export function useGetNFTMetadata(tokenId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.NFTMinter as `0x${string}`,
    abi: NFTMinterABI.abi,
    functionName: 'getMetadata',
    args: tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  })
}

export function useMintNFT() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const mintNFT = (topicId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.NFTMinter as `0x${string}`,
      abi: NFTMinterABI.abi,
      functionName: 'mintNfts',
      args: [BigInt(topicId)],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    mintNFT,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}
