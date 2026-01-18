import { createPublicClient, http, type Address, type Hex } from "viem";

const rpcUrl = process.env.RPC_URL;
const chainIdValue = process.env.CHAIN_ID;

if (!rpcUrl) {
  throw new Error("RPC_URL is required");
}

if (!chainIdValue) {
  throw new Error("CHAIN_ID is required");
}

const chainId = Number(chainIdValue);

export const publicClient = createPublicClient({
  transport: http(rpcUrl),
  chain: {
    id: chainId,
    name: "murmur-chain",
    nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  },
});

const vpTokenAddress = process.env.VP_TOKEN_ADDRESS as Address | undefined;
const nftAddress = process.env.MURMUR_NFT_ADDRESS as Address | undefined;

if (!vpTokenAddress) {
  throw new Error("VP_TOKEN_ADDRESS is required");
}

if (!nftAddress) {
  throw new Error("MURMUR_NFT_ADDRESS is required");
}

const vpAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "settlementNonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    type: "function",
    name: "userNonce",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    type: "function",
    name: "stakedVdot",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "calculateVP",
    stateMutability: "pure",
    inputs: [{ name: "vdotAmount", type: "uint256" }],
    outputs: [{ name: "vpAmount", type: "uint256" }],
  },
] as const;

const nftAbi = [
  {
    type: "function",
    name: "mintNonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    type: "function",
    name: "topicMinted",
    stateMutability: "view",
    inputs: [{ name: "topicId", type: "uint256" }],
    outputs: [{ name: "minted", type: "bool" }],
  },
] as const;

export async function getVpBalance(userAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: vpTokenAddress,
    abi: vpAbi,
    functionName: "balanceOf",
    args: [userAddress],
  });
}

export async function getSettlementNonce(): Promise<bigint> {
  return publicClient.readContract({
    address: vpTokenAddress,
    abi: vpAbi,
    functionName: "settlementNonce",
    args: [],
  });
}

export async function getUserNonce(userAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: vpTokenAddress,
    abi: vpAbi,
    functionName: "userNonce",
    args: [userAddress],
  });
}

export async function getStakedVdot(userAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: vpTokenAddress,
    abi: vpAbi,
    functionName: "stakedVdot",
    args: [userAddress],
  });
}

export async function calculateVp(vdotAmount: bigint): Promise<bigint> {
  return publicClient.readContract({
    address: vpTokenAddress,
    abi: vpAbi,
    functionName: "calculateVP",
    args: [vdotAmount],
  });
}

export async function getMintNonce(): Promise<bigint> {
  return publicClient.readContract({
    address: nftAddress,
    abi: nftAbi,
    functionName: "mintNonce",
    args: [],
  });
}

export async function isTopicMinted(topicId: bigint): Promise<boolean> {
  return publicClient.readContract({
    address: nftAddress,
    abi: nftAbi,
    functionName: "topicMinted",
    args: [topicId],
  });
}

export type { Address, Hex };
