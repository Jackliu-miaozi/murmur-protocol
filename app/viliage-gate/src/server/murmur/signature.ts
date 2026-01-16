/**
 * Murmur Protocol - EIP-712 Signature Service
 */
import { type Hex } from "viem";

// EIP-712 Domain
export const MURMUR_DOMAIN = {
  name: "MurmurVPToken",
  version: "2",
  // chainId will be set at runtime
  // verifyingContract will be set at runtime
};

// Type definitions for EIP-712
export const BATCH_BURN_TYPES = {
  BatchBurn: [
    { name: "users", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const BATCH_MINT_TYPES = {
  BatchMint: [
    { name: "users", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const MINT_NFT_TYPES = {
  MintNFT: [
    { name: "topicId", type: "uint256" },
    { name: "topicHash", type: "bytes32" },
    { name: "curatedHash", type: "bytes32" },
    { name: "refundUsers", type: "address[]" },
    { name: "refundAmounts", type: "uint256[]" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/**
 * Signature Service Interface
 */
export interface SignatureService {
  /**
   * Sign batch burn request
   */
  signBatchBurn(users: Hex[], amounts: bigint[], nonce: bigint): Promise<Hex>;

  /**
   * Sign batch mint request
   */
  signBatchMint(users: Hex[], amounts: bigint[], nonce: bigint): Promise<Hex>;

  /**
   * Sign NFT mint request
   */
  signMintNFT(
    topicId: bigint,
    topicHash: Hex,
    curatedHash: Hex,
    refundUsers: Hex[],
    refundAmounts: bigint[],
    nonce: bigint,
  ): Promise<Hex>;
}

/**
 * Mock Signature Service for Development
 * In production, use HSM or secure key management
 */
export class MockSignatureService implements SignatureService {
  async signBatchBurn(
    users: Hex[],
    amounts: bigint[],
    nonce: bigint,
  ): Promise<Hex> {
    // TODO: Implement actual EIP-712 signing with private key
    console.log("[MockSig] signBatchBurn:", { users, amounts, nonce });
    return ("0x" + "00".repeat(65)) as Hex;
  }

  async signBatchMint(
    users: Hex[],
    amounts: bigint[],
    nonce: bigint,
  ): Promise<Hex> {
    console.log("[MockSig] signBatchMint:", { users, amounts, nonce });
    return ("0x" + "00".repeat(65)) as Hex;
  }

  async signMintNFT(
    topicId: bigint,
    topicHash: Hex,
    curatedHash: Hex,
    refundUsers: Hex[],
    refundAmounts: bigint[],
    nonce: bigint,
  ): Promise<Hex> {
    console.log("[MockSig] signMintNFT:", {
      topicId,
      topicHash,
      curatedHash,
      refundUsers,
      refundAmounts,
      nonce,
    });
    return ("0x" + "00".repeat(65)) as Hex;
  }
}

// Singleton instance
export const signatureService = new MockSignatureService();
