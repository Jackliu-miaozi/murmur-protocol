/**
 * Murmur Protocol - EIP-712 Signature Service
 */
import { type Hex } from "viem";

// EIP-712 Domains
export const MURMUR_VP_DOMAIN = {
  name: "MurmurVPToken",
  version: "3",
  // chainId will be set at runtime
  // verifyingContract will be set at runtime
};

export const MURMUR_NFT_DOMAIN = {
  name: "MurmurNFT",
  version: "3",
  // chainId will be set at runtime
  // verifyingContract will be set at runtime
};

// Type definitions for EIP-712
export const SETTLEMENT_TYPES = {
  Settlement: [
    { name: "users", type: "address[]" },
    { name: "deltas", type: "int256[]" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "vpBurnAmount", type: "uint256" },
    { name: "vdotReturn", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const MINT_NFT_TYPES = {
  MintNFT: [
    { name: "minter", type: "address" },
    { name: "topicId", type: "uint256" },
    { name: "ipfsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/**
 * Signature Service Interface
 */
export interface SignatureService {
  /**
   * Sign settlement request
   */
  signSettlement(users: Hex[], deltas: bigint[], nonce: bigint): Promise<Hex>;

  /**
   * Sign withdraw request
   */
  signWithdraw(
    user: Hex,
    vpBurnAmount: bigint,
    vdotReturn: bigint,
    nonce: bigint,
  ): Promise<Hex>;

  /**
   * Sign NFT mint request
   */
  signMintNFT(
    minter: Hex,
    topicId: bigint,
    ipfsHash: Hex,
    nonce: bigint,
  ): Promise<Hex>;
}

/**
 * Mock Signature Service for Development
 * In production, use HSM or secure key management
 */
export class MockSignatureService implements SignatureService {
  async signSettlement(
    users: Hex[],
    deltas: bigint[],
    nonce: bigint,
  ): Promise<Hex> {
    // TODO: Implement actual EIP-712 signing with private key
    console.log("[MockSig] signSettlement:", { users, deltas, nonce });
    return ("0x" + "00".repeat(65)) as Hex;
  }

  async signWithdraw(
    user: Hex,
    vpBurnAmount: bigint,
    vdotReturn: bigint,
    nonce: bigint,
  ): Promise<Hex> {
    console.log("[MockSig] signWithdraw:", {
      user,
      vpBurnAmount,
      vdotReturn,
      nonce,
    });
    return ("0x" + "00".repeat(65)) as Hex;
  }

  async signMintNFT(
    minter: Hex,
    topicId: bigint,
    ipfsHash: Hex,
    nonce: bigint,
  ): Promise<Hex> {
    console.log("[MockSig] signMintNFT:", {
      minter,
      topicId,
      ipfsHash,
      nonce,
    });
    return ("0x" + "00".repeat(65)) as Hex;
  }
}

export class SupabaseSignatureService implements SignatureService {
  private getSupabaseConfig() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase signature config missing");
    }
    return { url, key };
  }

  private getChainId() {
    const raw = process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID;
    const chainId = Number(raw);
    if (!raw || Number.isNaN(chainId)) {
      throw new Error("CHAIN_ID is required for signatures");
    }
    return chainId;
  }

  private getVpContract() {
    const address = process.env.VP_TOKEN_ADDRESS;
    if (!address) {
      throw new Error("VP contract address is required");
    }
    return address;
  }

  private getNftContract() {
    const address = process.env.MURMUR_NFT_ADDRESS;
    if (!address) {
      throw new Error("NFT contract address is required");
    }
    return address;
  }

  private async requestSignature(payload: Record<string, unknown>): Promise<Hex> {
    const { url, key } = this.getSupabaseConfig();
    const response = await fetch(`${url}/functions/v1/sign-settlement`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Signature service error: ${response.status} ${response.statusText} ${message}`,
      );
    }

    const data = (await response.json()) as { signature?: Hex };
    if (!data.signature) {
      throw new Error("Signature missing in response");
    }

    return data.signature;
  }

  async signSettlement(
    users: Hex[],
    deltas: bigint[],
    nonce: bigint,
  ): Promise<Hex> {
    return this.requestSignature({
      type: "SETTLEMENT",
      users,
      deltas: deltas.map((delta) => delta.toString()),
      nonce: nonce.toString(),
      chainId: this.getChainId(),
      contractAddress: this.getVpContract(),
    });
  }

  async signWithdraw(
    user: Hex,
    vpBurnAmount: bigint,
    vdotReturn: bigint,
    nonce: bigint,
  ): Promise<Hex> {
    return this.requestSignature({
      type: "WITHDRAW",
      user,
      vpBurnAmount: vpBurnAmount.toString(),
      vdotReturn: vdotReturn.toString(),
      nonce: nonce.toString(),
      chainId: this.getChainId(),
      contractAddress: this.getVpContract(),
    });
  }

  async signMintNFT(
    minter: Hex,
    topicId: bigint,
    ipfsHash: Hex,
    nonce: bigint,
  ): Promise<Hex> {
    return this.requestSignature({
      type: "MINT_NFT",
      minter,
      topicId: topicId.toString(),
      ipfsHash,
      nonce: nonce.toString(),
      chainId: this.getChainId(),
      contractAddress: this.getNftContract(),
    });
  }
}

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const signatureService = hasSupabaseConfig
  ? new SupabaseSignatureService()
  : new MockSignatureService();
