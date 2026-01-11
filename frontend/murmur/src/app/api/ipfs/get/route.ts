import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { fetchMessageContent, getIpfsHash, storeHashMapping } from "@/lib/ipfs";
import { localPolkaVM } from "@/lib/wagmi/config";

// MessageRegistry ABI (minimal - just for events)
const MESSAGE_REGISTRY_ABI = [
  {
    type: "event",
    name: "MessagePosted",
    inputs: [
      { name: "messageId", type: "uint256", indexed: true },
      { name: "topicId", type: "uint256", indexed: true },
      { name: "author", type: "address", indexed: true },
      { name: "contentHash", type: "bytes32", indexed: false },
      { name: "vpCost", type: "uint256", indexed: false },
    ],
  },
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentHash = searchParams.get("contentHash");

    if (!contentHash) {
      return NextResponse.json(
        { error: "Missing contentHash parameter" },
        { status: 400 },
      );
    }

    // First, try to get from existing mapping
    const existingHash = getIpfsHash(contentHash);
    if (existingHash) {
      try {
        const content = await fetchMessageContent(existingHash);
        return NextResponse.json({ content, ipfsHash: existingHash });
      } catch (error) {
        console.error("Failed to fetch with existing hash:", error);
      }
    }

    // If not found, try to find from chain events
    // This is a fallback - in production, you'd want a proper indexing service
    const publicClient = createPublicClient({
      chain: localPolkaVM,
      transport: http("http://127.0.0.1:8545"),
    });

    // Get recent MessagePosted events
    const events = await publicClient.getLogs({
      address: CONTRACTS.MessageRegistry,
      event: MESSAGE_REGISTRY_ABI[0],
      fromBlock: "earliest",
      toBlock: "latest",
    });

    // Try to find matching contentHash in events
    // Note: This is a simplified approach - in production, you'd want to index these
    for (const event of events) {
      if (event.args.contentHash?.toLowerCase() === contentHash.toLowerCase()) {
        // Found the event, but we still need the IPFS hash
        // In a real system, you'd store this mapping when the event is emitted
        return NextResponse.json(
          {
            error:
              "Content hash found in events but IPFS mapping not available. " +
              "This message was likely posted before the mapping system was implemented.",
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      { error: "Content hash not found in chain events" },
      { status: 404 },
    );
  } catch (error) {
    console.error("Error fetching IPFS content:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch content",
      },
      { status: 500 },
    );
  }
}
