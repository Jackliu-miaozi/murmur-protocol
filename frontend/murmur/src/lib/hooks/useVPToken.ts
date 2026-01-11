"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, ABIS } from "@/lib/contracts";

export function useVPToken() {
  const { address } = useAccount();

  // Read VP balance
  const {
    data: vpBalance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: CONTRACTS.VPToken,
    abi: ABIS.VPToken,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read staked vDOT
  const {
    data: stakedVdot,
    isLoading: isLoadingStaked,
    refetch: refetchStaked,
  } = useReadContract({
    address: CONTRACTS.VPToken,
    abi: ABIS.VPToken,
    functionName: "stakedVdot",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Calculate VP from vDOT amount
  const { data: calculatedVP } = useReadContract({
    address: CONTRACTS.VPToken,
    abi: ABIS.VPToken,
    functionName: "calculateVP",
    args: [parseEther("1")], // Default 1 vDOT
  });

  // Write functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Stake vDOT to get VP
  const stakeVdot = async (amount: string) => {
    const amountWei = parseEther(amount);

    // First approve VPToken to spend vDOT
    await writeContractAsync({
      address: CONTRACTS.VDOTToken,
      abi: ABIS.VDOTToken,
      functionName: "approve",
      args: [CONTRACTS.VPToken, amountWei],
    });

    // Then stake
    const result = await writeContractAsync({
      address: CONTRACTS.VPToken,
      abi: ABIS.VPToken,
      functionName: "stakeVdot",
      args: [amountWei],
    });

    // Refetch balances
    await Promise.all([refetchBalance(), refetchStaked()]);

    return result;
  };

  // Withdraw vDOT
  const withdrawVdot = async (amount: string) => {
    const amountWei = parseEther(amount);

    const result = await writeContractAsync({
      address: CONTRACTS.VPToken,
      abi: ABIS.VPToken,
      functionName: "withdrawVdot",
      args: [amountWei],
    });

    await Promise.all([refetchBalance(), refetchStaked()]);

    return result;
  };

  // Calculate VP for given vDOT amount
  const calculateVP = (vdotAmount: string): bigint => {
    if (!calculatedVP) return 0n;
    const amountWei = parseEther(vdotAmount);
    // VP = 100 * sqrt(vDOT)
    // Since calculatedVP is for 1 vDOT, scale accordingly
    const ratio = amountWei / parseEther("1");
    // sqrt(ratio) approximation
    const sqrtRatio = BigInt(Math.floor(Math.sqrt(Number(ratio))));
    return (calculatedVP as bigint) * sqrtRatio;
  };

  return {
    // Data
    vpBalance: vpBalance ? formatEther(vpBalance as bigint) : "0",
    vpBalanceRaw: vpBalance as bigint | undefined,
    stakedVdot: stakedVdot ? formatEther(stakedVdot as bigint) : "0",
    stakedVdotRaw: stakedVdot as bigint | undefined,

    // Loading states
    isLoading: isLoadingBalance || isLoadingStaked,
    isPending,

    // Functions
    stakeVdot,
    withdrawVdot,
    calculateVP,
    refetchBalance,
    refetchStaked,
  };
}
