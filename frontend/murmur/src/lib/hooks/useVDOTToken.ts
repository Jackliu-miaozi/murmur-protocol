"use client";

import { useReadContract, useWriteContract, useAccount, usePublicClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, ABIS } from "@/lib/contracts";
import { useEffect, useState } from "react";

export function useVDOTToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isContractDeployed, setIsContractDeployed] = useState<boolean | null>(null);

  // Check if contract is deployed
  useEffect(() => {
    if (!publicClient || !CONTRACTS.VDOTToken) return;

    const checkContract = async () => {
      try {
        const code = await publicClient.getBytecode({
          address: CONTRACTS.VDOTToken,
        });
        setIsContractDeployed(code !== undefined && code !== "0x");
      } catch (error) {
        console.warn("Failed to check contract deployment:", error);
        setIsContractDeployed(false);
      }
    };

    checkContract();
  }, [publicClient]);

  // Read vDOT balance
  const {
    data: vdotBalance,
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch: refetchBalance,
  } = useReadContract({
    address: CONTRACTS.VDOTToken,
    abi: ABIS.VDOTToken,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!publicClient && isContractDeployed !== false,
      retry: 2,
      retryDelay: 1000,
    },
  });

  // Read allowance for VPToken
  const {
    data: vpTokenAllowance,
    isLoading: isLoadingAllowance,
    error: allowanceError,
    refetch: refetchAllowance,
  } = useReadContract({
    address: CONTRACTS.VDOTToken,
    abi: ABIS.VDOTToken,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.VPToken] : undefined,
    query: {
      enabled: !!address && !!publicClient && isContractDeployed !== false,
      retry: 2,
      retryDelay: 1000,
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

  // Log errors for debugging (only log if it's a real error, not just missing contract)
  useEffect(() => {
    if (balanceError) {
      const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
      // Only log if it's not a "no data" error (which might mean contract doesn't exist)
      if (!errorMessage.includes("returned no data")) {
        console.error("VDOTToken balance error:", balanceError);
      } else if (isContractDeployed === false) {
        console.warn("VDOTToken balance: Contract not deployed at", CONTRACTS.VDOTToken);
      }
    }
    if (allowanceError) {
      const errorMessage = allowanceError instanceof Error ? allowanceError.message : String(allowanceError);
      // Only log if it's not a "no data" error (which might mean contract doesn't exist)
      if (!errorMessage.includes("returned no data")) {
        console.error("VDOTToken allowance error:", allowanceError);
      } else if (isContractDeployed === false) {
        console.warn("VDOTToken allowance: Contract not deployed at", CONTRACTS.VDOTToken);
      }
    }
  }, [balanceError, allowanceError, isContractDeployed]);

  return {
    // Data - return "0" if error or no data
    vdotBalance: vdotBalance ? formatEther(vdotBalance as bigint) : "0",
    vdotBalanceRaw: vdotBalance as bigint | undefined,
    vpTokenAllowance: vpTokenAllowance
      ? formatEther(vpTokenAllowance as bigint)
      : "0",
    vpTokenAllowanceRaw: vpTokenAllowance as bigint | undefined,

    // Loading states
    isLoading: isLoadingBalance || isLoadingAllowance,
    isPending,
    error: balanceError || allowanceError,

    // Functions
    approve,
    refetchBalance,
    refetchAllowance,
  };
}
