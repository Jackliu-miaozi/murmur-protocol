import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// For local development: Use deployer (Alith) private key as verifier
// DO NOT use this in production - use a proper AI service instead
const VERIFIER_PRIVATE_KEY =
  process.env.VERIFIER_PRIVATE_KEY ||
  "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"; // Alith private key

// For local PolkaVM, use the actual chain ID from the network
// From checkBalance output, the chain ID is 420420420
// This should match the chain ID used when deploying the contract
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "420420420"); // Local PolkaVM chain ID
const AIScoreVerifier_ADDRESS =
  "0xb91C2eeaA0c475115069a6ED4bc601337a22788E";

// Build EIP-712 signature (matches contract implementation)
async function buildAISignature(
  contentHash: string,
  length: bigint,
  aiScore: bigint,
  timestamp: bigint,
): Promise<string> {
  console.log("🔐 Building AI signature with:");
  console.log("   Chain ID:", CHAIN_ID);
  console.log("   AIScoreVerifier Address:", AIScoreVerifier_ADDRESS);
  console.log("   Content Hash:", contentHash);
  console.log("   Length:", length.toString());
  console.log("   AI Score:", aiScore.toString());
  console.log("   Timestamp:", timestamp.toString());

  // Build domain separator (matches contract implementation exactly)
  // Contract uses: keccak256(abi.encode(keccak256("EIP712Domain(...)"), keccak256("MurmurProtocol"), keccak256("1"), block.chainid, address(this)))
  const domainTypeHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ),
  );

  const domainSeparator = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        domainTypeHash,
        ethers.keccak256(ethers.toUtf8Bytes("MurmurProtocol")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        BigInt(CHAIN_ID),
        AIScoreVerifier_ADDRESS,
      ],
    ),
  );

  console.log("   Domain Separator:", domainSeparator);

  // Build TYPE_HASH (matches contract)
  const TYPE_HASH = ethers.keccak256(
    ethers.toUtf8Bytes(
      "AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)",
    ),
  );

  // Build struct hash
  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
      [TYPE_HASH, contentHash, length, aiScore, timestamp],
    ),
  );

  console.log("   Struct Hash:", structHash);

  // Build EIP-712 hash (matches contract: keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)))
  // Use concat to match abi.encodePacked behavior
  const hash = ethers.keccak256(
    ethers.concat([
      "0x19",
      "0x01",
      domainSeparator,
      structHash,
    ]),
  );

  console.log("   EIP-712 Hash:", hash);

  // Sign with verifier private key
  const wallet = new ethers.Wallet(VERIFIER_PRIVATE_KEY);
  const hashBytes = ethers.getBytes(hash);
  const signature = wallet.signingKey.sign(hashBytes);

  const finalSignature = ethers.concat([
    signature.r,
    signature.s,
    ethers.toBeHex(signature.v, 1),
  ]);

  console.log("   Signature:", finalSignature);
  console.log("   Signer Address:", wallet.address);

  return finalSignature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentHash, length, aiScore, timestamp } = body;

    // Validate inputs
    if (!contentHash || length === undefined || aiScore === undefined || timestamp === undefined) {
      return NextResponse.json(
        { error: "Missing required parameters: contentHash, length, aiScore, timestamp" },
        { status: 400 },
      );
    }

    // Generate signature
    const signature = await buildAISignature(
      contentHash,
      BigInt(length),
      BigInt(aiScore),
      BigInt(timestamp),
    );

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("Error generating AI signature:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate signature" },
      { status: 500 },
    );
  }
}
