/**
 * Murmur Protocol - Message Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  messageStore,
  topicStore,
  vpStore,
  curationStore,
  TopicStatus,
  VpAction,
} from "@/server/murmur/store";
import { keccak256, toHex } from "viem";

// VP cost calculation constants
const BASE_COST = BigInt(10) * BigInt(10 ** 18); // 10 VP
const LIKE_COST = BigInt(1) * BigInt(10 ** 18); // 1 VP

export const messageRouter = createTRPCRouter({
  /**
   * Post a new message
   */
  post: publicProcedure
    .input(
      z.object({
        topicId: z.number(),
        content: z.string().min(1).max(5000),
        author: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new Error("Topic not found");
      }
      if (topic.status !== TopicStatus.LIVE) {
        throw new Error("Topic is not live");
      }
      if (topicStore.isExpired(topic)) {
        await topicStore.updateStatus(input.topicId, TopicStatus.CLOSED);
        throw new Error("Topic has expired");
      }

      // Calculate content hash
      const contentHash = keccak256(toHex(input.content));

      // Calculate VP cost (simplified)
      const length = input.content.length;
      const aiScore = 0.5; // TODO: Call AI service

      const lengthMultiplier = 1 + 0.15 * Math.log(1 + length);
      const intensityMultiplier = 1 + 2 * aiScore * aiScore;
      const vpCostNumber = Math.floor(
        (Number(BASE_COST) * lengthMultiplier * intensityMultiplier) / 10 ** 18,
      );
      const vpCost = BigInt(vpCostNumber) * BigInt(10 ** 18);

      // Create message
      const message = await messageStore.create({
        topicId: input.topicId,
        author: input.author.toLowerCase(),
        content: input.content,
        contentHash,
        length,
        aiScore,
        vpCost: vpCostNumber,
      });

      // Record VP consumption
      await vpStore.record(
        input.topicId,
        input.author,
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
  like: publicProcedure
    .input(
      z.object({
        messageId: z.number(),
        userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const message = await messageStore.get(input.messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      const topic = await topicStore.get(message.topicId);
      if (!topic || topic.status !== TopicStatus.LIVE) {
        throw new Error("Topic is not live");
      }

      // Like the message
      const updated = await messageStore.like(input.messageId);

      // Record VP consumption
      await vpStore.record(
        message.topicId,
        input.userAddress,
        LIKE_COST,
        VpAction.LIKE,
      );

      // Update curation
      if (updated) {
        await curationStore.update(
          message.topicId,
          input.messageId,
          updated.likeCount,
        );
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
