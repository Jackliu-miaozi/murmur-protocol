import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../contracts/addresses'
import MessageRegistryABI from '../contracts/abis/MessageRegistry.json'

export function useGetMessage(messageId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.MessageRegistry as `0x${string}`,
    abi: MessageRegistryABI.abi,
    functionName: 'getMessage',
    args: messageId !== undefined ? [BigInt(messageId)] : undefined,
    query: {
      enabled: messageId !== undefined,
    },
  })
}

export function useGetMessagesByTopic(topicId?: number, offset = 0, limit = 50) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.MessageRegistry as `0x${string}`,
    abi: MessageRegistryABI.abi,
    functionName: 'getMessagesByTopic',
    args: topicId !== undefined ? [BigInt(topicId), BigInt(offset), BigInt(limit)] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  })
}

export function usePostMessage() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const postMessage = (
    topicId: number,
    contentHash: string,
    length: number,
    aiScore: bigint,
    timestamp: number,
    signature: string
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.MessageRegistry as `0x${string}`,
      abi: MessageRegistryABI.abi,
      functionName: 'postMessage',
      args: [BigInt(topicId), contentHash, BigInt(length), aiScore, BigInt(timestamp), signature],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    postMessage,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}

export function useLikeMessage() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const likeMessage = (topicId: number, messageId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.MessageRegistry as `0x${string}`,
      abi: MessageRegistryABI.abi,
      functionName: 'likeMessage',
      args: [BigInt(topicId), BigInt(messageId)],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    likeMessage,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}
