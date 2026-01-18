import { NextResponse } from "next/server";
import { vpStore } from "@/server/murmur/store";
import { signatureService } from "@/server/murmur/signature";
import { getSettlementNonce } from "@/server/murmur/chain";

export const runtime = "nodejs";
export const maxDuration = 60;

const batchSize = 200;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const aggregated = await vpStore.aggregateUnsettled();
  const users = Array.from(aggregated.keys());
  if (users.length === 0) {
    return NextResponse.json({ settled: false, reason: "No pending" });
  }

  const threshold = BigInt(
    process.env.SETTLEMENT_THRESHOLD_VP || "10000000000000000000000",
  );
  const minUsers = Number(process.env.MIN_SETTLEMENT_USERS || "5");

  const deltas = users.map((u) => aggregated.get(u)!);
  const totalVP = deltas.reduce((sum, d) => sum + d, 0n);

  if (totalVP < threshold && users.length < minUsers) {
    return NextResponse.json({
      settled: false,
      reason: "Below threshold",
      pendingVP: totalVP.toString(),
      users: users.length,
    });
  }

  const batchUsers = users.slice(0, batchSize) as `0x${string}`[];
  const batchDeltas = batchUsers.map((u) => aggregated.get(u)!);

  const nonce = await getSettlementNonce();
  const signature = await signatureService.signSettlement(
    batchUsers,
    batchDeltas,
    nonce,
  );

  return NextResponse.json({
    settled: true,
    users: batchUsers.length,
    totalVP: batchDeltas.reduce((sum, d) => sum + d, 0n).toString(),
    nonce: nonce.toString(),
    signature,
    hasMore: users.length > batchUsers.length,
  });
}
