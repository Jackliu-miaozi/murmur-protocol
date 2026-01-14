// Contract addresses for local PolkaVM chain
// Update these addresses after deploying contracts

export const CONTRACTS = {
  VDOTToken: "0x85b108660f47caDfAB9e0503104C08C1c96e0DA9" as `0x${string}`,
  VPToken: "0x3ed62137c5DB927cb137c26455969116BF0c23Cb" as `0x${string}`,
  TopicFactory: "0x21cb3940e6Ba5284E1750F1109131a8E8062b9f1" as `0x${string}`,
  MessageRegistry:
    "0x527FC4060Ac7Bf9Cd19608EDEeE8f09063A16cd4" as `0x${string}`,
  CurationModule: "0xb6F2B9415fc599130084b7F20B84738aCBB15930" as `0x${string}`,
  NFTMinter: "0x1377Ce7BadadB01a2D06Dc41f31e8B57d9882888" as `0x${string}`,
  TopicVault: "0x7d4567B7257cf869B01a47E8cf0EDB3814bDb963" as `0x${string}`,
  AIScoreVerifier:
    "0x5CC307268a1393AB9A764A20DACE848AB8275c46" as `0x${string}`,
} as const;

// Helper function to update contract addresses (for development)
export function updateContractAddress(
  name: keyof typeof CONTRACTS,
  address: `0x${string}`,
) {
  (CONTRACTS as Record<string, `0x${string}`>)[name] = address;
}
