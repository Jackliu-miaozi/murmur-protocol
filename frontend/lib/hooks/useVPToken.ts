import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from './addresses'
import VPTokenABI from './abis/VPToken.json'

export function useVPBalance(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.VPToken as `0x${string}`,
    abi: VPTokenABI.abi,
    functionName: 'balanceOf',
    args: address ? [address, 1] : undefined, // tokenId = 1 for VP
    query: {
      enabled: !!address,
    },
  })
}

export function useStakedVdot(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.VPToken as `0x${string}`,
    abi: VPTokenABI.abi,
    functionName: 'stakedVdot',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })
}

export function useStakeVdot() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const stake = (amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.VPToken as `0x${string}`,
      abi: VPTokenABI.abi,
      functionName: 'stakeVdot',
      args: [amount],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    stake,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}

export function useWithdrawVdot() {
  const { writeContract, data: hash, ...rest } = useWriteContract()
  
  const withdraw = (amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.VPToken as `0x${string}`,
      abi: VPTokenABI.abi,
      functionName: 'withdrawVdot',
      args: [amount],
    })
  }

  const receipt = useWaitForTransactionReceipt({ hash })

  return {
    withdraw,
    hash,
    isLoading: rest.isPending,
    isSuccess: receipt.isSuccess,
    ...rest,
  }
}
