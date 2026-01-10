import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../contracts/addresses'
import TopicFactoryABI from '../contracts/abis/TopicFactory.json'

export function useQuoteCreationCost() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TopicFactory as `0x${string}`,
    abi: TopicFactoryABI.abi,
    functionName: 'quoteCreationCost',
  })
}

export function useGetTopic(topicId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TopicFactory as `0x${string}`,
    abi: TopicFactoryABI.abi,
    functionName: 'getTopic',
    args: topicId !== undefined ? [BigInt(topicId)] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  })
}

export function useCreateTopic() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const createTopic = (
    metadataHash: string,
    duration: number,
    freezeWindow: number,
    curatedLimit: number
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.TopicFactory as `0x${string}`,
      abi: TopicFactoryABI.abi,
      functionName: 'createTopic',
      args: [metadataHash, BigInt(duration), BigInt(freezeWindow), BigInt(curatedLimit)],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    createTopic,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}
