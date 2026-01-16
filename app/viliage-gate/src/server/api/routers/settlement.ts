/**
 * Murmur Protocol - Settlement Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  vpStore,
  topicStore,
  curationStore,
  settlementStore,
  mintedNFTStore,
  TopicStatus,
} from "@/server/murmur/store";
import { signatureService } from "@/server/murmur/signature";
import { type Hex } from "viem";

export const settlementRouter = createTRPCRouter({
  /**
   * Get pending VP settlements
   */
  getPending: publicProcedure.query(async () => {
    const aggregated = await vpStore.aggregateUnsettled();
    const users = Array.from(aggregated.keys());
    const amounts = users.map((u) => aggregated.get(u)!.toString());

    return {
      users,
      amounts,
      count: users.length,
      totalVP: amounts.reduce((sum, a) => sum + BigInt(a), 0n).toString(),
    };
  }),

  /**
   * Generate batch burn signature
   */
  signBatchBurn: publicProcedure.mutation(async () => {
    const aggregated = await vpStore.aggregateUnsettled();
    const users = Array.from(aggregated.keys()) as Hex[];
    const amounts = users.map((u) => aggregated.get(u)!);

    if (users.length === 0) {
      throw new Error("No pending settlements");
    }

    const nonce = await settlementStore.getNextNonce();

    const signature = await signatureService.signBatchBurn(
      users,
      amounts,
      BigInt(nonce),
    );

    // Create settlement record
    const settlement = await settlementStore.create(nonce, "BATCH_BURN");

    return {
      settlementId: settlement.id,
      users,
      amounts: amounts.map((a) => a.toString()),
      nonce,
      signature,
    };
  }),

  /**
   * Confirm settlement (after tx confirmed on-chain)
   */
  confirmSettlement: publicProcedure
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

      return {
        settledCount: ids.length,
        txHash: input.txHash,
      };
    }),

  /**
   * Generate NFT mint signature (with VP refunds)
   */
  signMintNFT: publicProcedure
    .input(z.object({ topicId: z.number() }))
    .mutation(async ({ input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new Error("Topic not found");
      }
      if (topic.status !== TopicStatus.CLOSED) {
        throw new Error("Topic must be closed to mint NFT");
      }

      // Check if already minted
      const existing = await mintedNFTStore.getByTopic(input.topicId);
      if (existing) {
        throw new Error("NFT already minted for this topic");
      }

      // Get curated hash
      const curatedHash = (await curationStore.getCuratedHash(
        input.topicId,
      )) as Hex;

      // Get refund data
      const { users, amounts } = await vpStore.getRefundData(input.topicId);

      const nonce = await settlementStore.getNextNonce();

      // Generate signature
      const signature = await signatureService.signMintNFT(
        BigInt(input.topicId),
        topic.metadataHash as Hex,
        curatedHash,
        users as Hex[],
        amounts,
        BigInt(nonce),
      );

      return {
        topicId: input.topicId,
        topicHash: topic.metadataHash,
        curatedHash,
        refundUsers: users,
        refundAmounts: amounts.map((a) => a.toString()),
        nonce,
        signature,
      };
    }),

  /**
   * Record minted NFT
   */
  recordMintedNFT: publicProcedure
    .input(
      z.object({
        topicId: z.number(),
        tokenId: z.number(),
        minter: z.string(),
        txHash: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new Error("Topic not found");
      }

      const curatedHash = await curationStore.getCuratedHash(input.topicId);

      const nft = await mintedNFTStore.create({
        topicId: input.topicId,
        tokenId: input.tokenId,
        topicHash: topic.metadataHash,
        curatedHash,
        minter: input.minter.toLowerCase(),
        txHash: input.txHash,
      });

      // Update topic status to MINTED
      await topicStore.updateStatus(input.topicId, TopicStatus.MINTED);

      return { nft };
    }),

  /**
   * Get VP consumption history for a user
   */
  getUserVpHistory: publicProcedure
    .input(
      z.object({
        userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      }),
    )
    .query(async ({ input }) => {
      const consumptions = await vpStore.getByUser(input.userAddress);
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
