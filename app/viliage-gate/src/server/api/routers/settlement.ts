/**
 * Murmur Protocol - Settlement Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
  mintedNFTStore,
  settlementStore,
  TopicStatus,
  topicStore,
  vpRewardStore,
  vpStore,
} from "@/server/murmur/store";
import { getMintNonce, getSettlementNonce } from "@/server/murmur/chain";
import { signatureService } from "@/server/murmur/signature";
import { TRPCError } from "@trpc/server";
import { type Hex } from "viem";

export const settlementRouter = createTRPCRouter({
  /**
   * Get pending VP settlements
   */
  getPending: publicProcedure.query(async () => {
    const aggregated = await vpStore.aggregateUnsettled();
    const users = Array.from(aggregated.keys());
    const deltas = users.map((u) => aggregated.get(u)!.toString());

    return {
      users,
      deltas,
      count: users.length,
      totalVP: deltas.reduce((sum, a) => sum + BigInt(a), 0n).toString(),
    };
  }),

  /**
   * Generate batch burn signature
   */
  signSettlement: protectedProcedure
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
      const users = Array.from(aggregated.keys()) as Hex[];

      if (users.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending settlements",
        });
      }

      const limit = input?.limit ?? 200;
      const batchUsers = users.slice(0, limit);
      const batchDeltas = batchUsers.map((u) => aggregated.get(u)!);

      if (input?.dryRun) {
        return {
          dryRun: true,
          users: batchUsers.length,
          totalVP: batchDeltas.reduce((sum, d) => sum + d, 0n).toString(),
          hasMore: users.length > batchUsers.length,
        };
      }

      const nonce = await getSettlementNonce();

      const signature = await signatureService.signSettlement(
        batchUsers,
        batchDeltas,
        nonce,
      );

      const settlement = await settlementStore.getOrCreate(
        Number(nonce),
        "BATCH_BURN",
      );

      return {
        settlementId: settlement.id,
        users: batchUsers,
        deltas: batchDeltas.map((d) => d.toString()),
        nonce: nonce.toString(),
        signature,
        hasMore: users.length > batchUsers.length,
      };
    }),

  /**
   * Confirm settlement (after tx confirmed on-chain)
   */
  confirmSettlement: protectedProcedure
    .input(
      z.object({
        settlementId: z.number(),
        txHash: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      // Confirm settlement
      await settlementStore.confirm(input.settlementId, input.txHash);

      // Get and mark all unsettled consumptions as settled
      const unsettled = await vpStore.getUnsettled();
      const ids = unsettled.map((c) => c.id);
      await vpStore.markSettled(ids, input.settlementId);

      const rewards = await vpStore.getUnprocessedRewards();
      const rewardIds = rewards.map((r) => r.id);
      await vpRewardStore.markProcessed(rewardIds);

      return {
        settledCount: ids.length,
        rewardCount: rewardIds.length,
        txHash: input.txHash,
      };
    }),

  /**
   * Generate NFT mint signature (with VP refunds)
   */
  signMintNFT: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.status !== TopicStatus.LANDED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic must be landed to mint NFT",
        });
      }
      if (!topic.ipfsHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing ipfsHash",
        });
      }

      // Check if already minted
      const existing = await mintedNFTStore.getByTopic(input.topicId);
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "NFT already minted for this topic",
        });
      }

      const nonce = await getMintNonce();

      // Generate signature
      const signature = await signatureService.signMintNFT(
        ctx.userAddress as Hex,
        BigInt(input.topicId),
        topic.ipfsHash as Hex,
        nonce,
      );

      return {
        topicId: input.topicId,
        ipfsHash: topic.ipfsHash,
        nonce: nonce.toString(),
        signature,
      };
    }),

  /**
   * Record minted NFT
   */
  recordMintedNFT: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        tokenId: z.number(),
        txHash: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }

      const nft = await mintedNFTStore.create({
        topicId: input.topicId,
        tokenId: input.tokenId,
        topicHash: topic.metadataHash,
        curatedHash: topic.ipfsHash ?? topic.metadataHash,
        minter: ctx.userAddress,
        txHash: input.txHash,
      });

      // Update topic status to MINTED
      await topicStore.updateStatus(input.topicId, TopicStatus.MINTED);

      return { nft };
    }),

  /**
   * Get VP consumption history for a user
   */
  getUserVpHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const consumptions = await vpStore.getByUser(ctx.userAddress);
      const total = consumptions.reduce(
        (sum, c) => sum + BigInt(c.amount.toString()),
        0n,
      );
      const unsettled = consumptions
        .filter((c) => !c.settled)
        .reduce((sum, c) => sum + BigInt(c.amount.toString()), 0n);

      return {
        consumptions: consumptions.map((c) => ({
          ...c,
          amount: c.amount.toString(),
        })),
        total: total.toString(),
        unsettled: unsettled.toString(),
      };
    }),
});
