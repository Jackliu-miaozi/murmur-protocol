// Contract addresses for local PolkaVM chain
// Update these addresses after deploying contracts

export const CONTRACTS = {
  VDOTToken: "0x85b108660f47caDfAB9e0503104C08C1c96e0DA9" as `0x${string}`,
  VPToken: "0xF0e46847c8bFD122C4b5EEE1D4494FF7C5FC5104" as `0x${string}`,
  TopicFactory: "0xD45E290062Bd0D1C640D59C350cA03CC291b37FA" as `0x${string}`,
  MessageRegistry:
    "0x07aa061c3d7E291348Ea2Df3C33ccFe61c926AcB" as `0x${string}`,
  CurationModule: "0xC530e4cD4933357da902577E78cC7C65C5759e0C" as `0x${string}`,
  NFTMinter: "0x6CAa59f27B0b3b5Adc07a2b3EcB7142B3C74f424" as `0x${string}`,
  TopicVault: "0x115f277e8fcE437B1F513A293057D2E396Ac2EC1" as `0x${string}`,
  AIScoreVerifier:
    "0xb91C2eeaA0c475115069a6ED4bc601337a22788E" as `0x${string}`,
} as const;

// Helper function to update contract addresses (for development)
export function updateContractAddress(
  name: keyof typeof CONTRACTS,
  address: `0x${string}`,
) {
  (CONTRACTS as Record<string, `0x${string}`>)[name] = address;
}
