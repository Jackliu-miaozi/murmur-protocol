import type { TopicMetadata, MessageContent } from "@/types";

// Pinata API endpoints
const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs";

// Get Pinata credentials from environment variables
function getPinataCredentials(): {
  apiKey: string;
  apiSecret: string;
} {
  // Try API Key + Secret first (recommended for pinning API)
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.NEXT_PUBLIC_PINATA_API_SECRET;

  if (apiKey && apiSecret) {
    return { apiKey, apiSecret };
  }

  // Fallback to JWT (less secure, mainly for gateway)
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (jwt) {
    // If only JWT is provided, we'll try to use it but recommend API Key + Secret
    console.warn(
      "Using JWT token for Pinata. For better security, use API Key + API Secret instead."
    );
    // JWT can't be used directly for pinning API, so we need to throw an error
    throw new Error(
      "Pinata API requires API Key and API Secret. Please set NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_API_SECRET in your .env.local file."
    );
  }

  throw new Error(
    "Pinata credentials not found. Please set NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_API_SECRET in your .env.local file."
  );
}

// Upload JSON to IPFS
export async function uploadJSON<T>(data: T, name?: string): Promise<string> {
  const { apiKey, apiSecret } = getPinataCredentials();

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: name ?? "murmur-data",
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = `Failed to upload to IPFS: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = `Failed to upload to IPFS: ${JSON.stringify(errorData)}`;
    } catch {
      const errorText = await response.text();
      errorMessage = `Failed to upload to IPFS: ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return result.IpfsHash;
}

// Fetch JSON from IPFS
export async function fetchJSON<T>(hash: string): Promise<T> {
  const response = await fetch(`${PINATA_GATEWAY_URL}/${hash}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Upload topic metadata
export async function uploadTopicMetadata(
  metadata: TopicMetadata,
): Promise<string> {
  return uploadJSON(metadata, `topic-${metadata.title}`);
}

// Fetch topic metadata
export async function fetchTopicMetadata(hash: string): Promise<TopicMetadata> {
  return fetchJSON<TopicMetadata>(hash);
}

// Upload message content
export async function uploadMessageContent(
  content: MessageContent,
): Promise<string> {
  return uploadJSON(content, `message-${content.timestamp}`);
}

// Fetch message content
export async function fetchMessageContent(
  hash: string,
): Promise<MessageContent> {
  return fetchJSON<MessageContent>(hash);
}

// Convert IPFS hash to bytes32 (for contract)
export function hashToBytes32(ipfsHash: string): `0x${string}` {
  // Use keccak256 hash of the IPFS hash string
  // This is a simplified version - in production you might want to use the actual CID bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(ipfsHash);

  // Simple hash function (for demo - in production use proper crypto)
  let hash = 0n;
  for (const byte of data) {
    hash = (hash * 31n + BigInt(byte)) % 2n ** 256n;
  }

  return `0x${hash.toString(16).padStart(64, "0")}`;
}

// Convert bytes32 back to retrieve IPFS hash (requires lookup table in production)
// Store mapping in localStorage for persistence across page refreshes
const STORAGE_KEY = "murmur_ipfs_hash_mapping";

function getHashMapping(): Map<string, string> {
  if (typeof window === "undefined") {
    return new Map();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as Record<string, string>;
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error("Failed to load hash mapping from localStorage:", error);
  }

  return new Map();
}

function saveHashMapping(mapping: Map<string, string>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const data = Object.fromEntries(mapping);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save hash mapping to localStorage:", error);
  }
}

export function storeHashMapping(bytes32: string, ipfsHash: string): void {
  const mapping = getHashMapping();
  mapping.set(bytes32.toLowerCase(), ipfsHash);
  saveHashMapping(mapping);
}

export function getIpfsHash(bytes32: string): string | undefined {
  const mapping = getHashMapping();
  return mapping.get(bytes32.toLowerCase());
}

// Helper to get all stored mappings (for debugging)
export function getAllHashMappings(): Record<string, string> {
  const mapping = getHashMapping();
  return Object.fromEntries(mapping);
}
