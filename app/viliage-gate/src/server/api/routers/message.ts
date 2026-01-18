/**
 * Murmur Protocol - Message Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
  curationStore,
  likeStore,
  messageStore,
  topicStore,
  vpBalanceStore,
  vpRewardStore,
  vpStore,
  TopicStatus,
  VpAction,
} from "@/server/murmur/store";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { keccak256, toHex } from "viem";

// VP cost calculation constants
const BASE_COST = BigInt(2) * BigInt(10 ** 18); // 2 VP
const LIKE_COST = BigInt(1) * BigInt(10 ** 18); // 1 VP

export const messageRouter = createTRPCRouter({
  /**
   * Post a new message
   */
  post: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        content: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.status !== TopicStatus.LIVE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic is not live",
        });
      }
      if (topicStore.isExpired(topic)) {
        await topicStore.updateStatus(input.topicId, TopicStatus.CLOSED);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic has expired",
        });
      }
      if (topicStore.isFrozen(topic)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic is frozen",
        });
      }

      // Calculate content hash
      const contentHash = keccak256(toHex(input.content));

      // Calculate VP cost (useway)
      const length = input.content.length;
      const aiScore = 0.5; // Fixed for MVP
      const lengthMultiplier = 1 + 0.05 * Math.max(length - 10, 0);
      const intensityMultiplier = 1 + 9 * aiScore * aiScore;
      const vpCost =
        (BASE_COST * BigInt(Math.round(lengthMultiplier * 100)) *
          BigInt(Math.round(intensityMultiplier * 100))) /
        10_000n;

      const balance = await vpBalanceStore.getEffectiveBalance(ctx.userAddress);
      if (balance < vpCost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient VP",
        });
      }

      // Create message
      const message = await messageStore.create({
        topicId: input.topicId,
        author: ctx.userAddress,
        content: input.content,
        contentHash,
        length,
        aiScore,
        vpCost,
      });

      await vpBalanceStore.deductBalance(ctx.userAddress, vpCost);

      // Record VP consumption
      await vpStore.record(
        input.topicId,
        ctx.userAddress,
        vpCost,
        VpAction.MESSAGE,
      );

      return {
        message,
        vpCost: vpCost.toString(),
      };
    }),

  /**
   * Get message by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const message = await messageStore.get(input.id);
      if (!message) {
        throw new Error("Message not found");
      }
      return message;
    }),

  /**
   * List messages by topic
   */
  listByTopic: publicProcedure
    .input(
      z.object({
        topicId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const messages = await messageStore.listByTopic(
        input.topicId,
        input.limit,
        input.offset,
      );
      return { messages };
    }),

  /**
   * Like a message
   */
  like: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await messageStore.get(input.messageId);
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      const topic = await topicStore.get(message.topicId);
      if (!topic || topic.status !== TopicStatus.LIVE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic is not live",
        });
      }

      const balance = await vpBalanceStore.getEffectiveBalance(ctx.userAddress);
      if (balance < LIKE_COST) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient VP",
        });
      }

      try {
        await likeStore.create(input.messageId, ctx.userAddress);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Already liked",
          });
        }
        throw error;
      }

      // Like the message
      const updated = await messageStore.like(input.messageId);

      await vpBalanceStore.deductBalance(ctx.userAddress, LIKE_COST);

      // Record VP consumption
      await vpStore.record(
        message.topicId,
        ctx.userAddress,
        LIKE_COST,
        VpAction.LIKE,
      );

      await vpRewardStore.grantResonanceBonus(input.messageId, ctx.userAddress);

      // Update curation
      if (updated) {
        const { added } = await curationStore.update(
          message.topicId,
          input.messageId,
          updated.likeCount,
        );
        if (added) {
          await vpRewardStore.grantCuratedBonus(
            message.topicId,
            input.messageId,
          );
        }
      }

      return {
        message: updated,
        vpCost: LIKE_COST.toString(),
      };
    }),

  /**
   * Get curated messages for a topic
   */
  getCurated: publicProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ input }) => {
      const curated = await curationStore.get(input.topicId);
      return { curated };
    }),
});
