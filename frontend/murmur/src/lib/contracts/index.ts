// Re-export contract addresses
export { CONTRACTS } from "./addresses";

// Import ABIs
import VDOTTokenABI from "./abis/VDOTToken.json";
import VPTokenABI from "./abis/VPToken.json";
import TopicFactoryABI from "./abis/TopicFactory.json";
import MessageRegistryABI from "./abis/MessageRegistry.json";
import CurationModuleABI from "./abis/CurationModule.json";
import NFTMinterABI from "./abis/NFTMinter.json";

// Export ABIs
export const ABIS = {
  VDOTToken: VDOTTokenABI,
  VPToken: VPTokenABI,
  TopicFactory: TopicFactoryABI,
  MessageRegistry: MessageRegistryABI,
  CurationModule: CurationModuleABI,
  NFTMinter: NFTMinterABI,
} as const;

// Topic status enum (matching contract)
export enum TopicStatus {
  Draft = 0,
  Live = 1,
  Closed = 2,
  Minted = 3,
  Settled = 4,
}

// Topic status labels
export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  [TopicStatus.Draft]: "Draft",
  [TopicStatus.Live]: "Live",
  [TopicStatus.Closed]: "Closed",
  [TopicStatus.Minted]: "Minted",
  [TopicStatus.Settled]: "Settled",
};

// Topic status colors
export const TOPIC_STATUS_COLORS: Record<TopicStatus, string> = {
  [TopicStatus.Draft]: "bg-gray-500",
  [TopicStatus.Live]: "bg-green-500",
  [TopicStatus.Closed]: "bg-yellow-500",
  [TopicStatus.Minted]: "bg-purple-500",
  [TopicStatus.Settled]: "bg-blue-500",
};
