import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  settlementStore,
  topicStatsStore,
  vpStore,
} from "@/server/murmur/store";
import { getSettlementNonce } from "@/server/murmur/chain";
import { signatureService } from "@/server/murmur/signature";
import { type Hex } from "viem";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const adminList = (process.env.ADMIN_WALLETS || "")
    .toLowerCase()
    .split(",")
    .filter(Boolean);

  if (!adminList.includes(ctx.userAddress)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next();
});

export const adminRouter = createTRPCRouter({
  getStats: adminProcedure.query(async () => {
    const aggregated = await vpStore.aggregateUnsettled();
    const users = Array.from(aggregated.keys());
    const deltas = users.map((u) => aggregated.get(u)!);
    const totalVP = deltas.reduce((sum, d) => sum + d, 0n);

    const [latestSettlement, topicStats] = await Promise.all([
      settlementStore.getLatest(),
      topicStatsStore.countByStatus(),
    ]);

    return {
      pendingUsers: users.length,
      pendingVP: totalVP.toString(),
      latestSettlement,
      topicStats,
    };
  }),

  triggerSettlement: adminProcedure
    .input(
      z
        .object({
          dryRun: z.boolean().optional(),
          limit: z.number().min(1).max(200).optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const aggregated = await vpStore.aggregateUnsettled();
      const users = Array.from(aggregated.keys());
      const deltas = users.map((u) => aggregated.get(u)!);

      if (users.length === 0) {
        return { triggered: false, reason: "No pending settlements" };
      }

      const limit = input?.limit ?? 200;
      const batchUsers = users.slice(0, limit);
      const batchDeltas = batchUsers.map((u) => aggregated.get(u)!);

      if (input?.dryRun) {
        return {
          triggered: false,
          dryRun: true,
          users: batchUsers.length,
          totalVP: batchDeltas.reduce((sum, d) => sum + d, 0n).toString(),
        };
      }

      const nonce = await getSettlementNonce();
      const signature = await signatureService.signSettlement(
        batchUsers as Hex[],
        batchDeltas,
        nonce,
      );

      const settlement = await settlementStore.getOrCreate(
        Number(nonce),
        "BATCH_BURN",
      );

      return {
        triggered: true,
        settlementId: settlement.id,
        users: batchUsers,
        deltas: batchDeltas.map((d) => d.toString()),
        nonce: nonce.toString(),
        signature,
        totalVP: batchDeltas.reduce((sum, d) => sum + d, 0n).toString(),
        hasMore: users.length > batchUsers.length,
      };
    }),
});
