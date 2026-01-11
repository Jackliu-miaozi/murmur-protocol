"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, ABIS } from "@/lib/contracts";

export function useVDOTToken() {
  const { address } = useAccount();

  // Read vDOT balance
  const {
    data: vdotBalance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: CONTRACTS.VDOTToken,
    abi: ABIS.VDOTToken,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read allowance for VPToken
  const {
    data: vpTokenAllowance,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: CONTRACTS.VDOTToken,
    abi: ABIS.VDOTToken,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.VPToken] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Approve VPToken to spend vDOT
  const approve = async (spender: `0x${string}`, amount: string) => {
    const amountWei = parseEther(amount);

    const result = await writeContractAsync({
      address: CONTRACTS.VDOTToken,
      abi: ABIS.VDOTToken,
      functionName: "approve",
      args: [spender, amountWei],
    });

    await refetchAllowance();

    return result;
  };

  return {
    // Data
    vdotBalance: vdotBalance ? formatEther(vdotBalance as bigint) : "0",
    vdotBalanceRaw: vdotBalance as bigint | undefined,
    vpTokenAllowance: vpTokenAllowance
      ? formatEther(vpTokenAllowance as bigint)
      : "0",
    vpTokenAllowanceRaw: vpTokenAllowance as bigint | undefined,

    // Loading states
    isLoading: isLoadingBalance || isLoadingAllowance,
    isPending,

    // Functions
    approve,
    refetchBalance,
    refetchAllowance,
  };
}
