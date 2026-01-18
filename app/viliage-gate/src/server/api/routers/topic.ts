/**
 * Murmur Protocol - Topic Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
  topicStore,
  vpBalanceStore,
  vpStore,
  TopicStatus,
  VpAction,
} from "@/server/murmur/store";
import { TRPCError } from "@trpc/server";

export const topicRouter = createTRPCRouter({
  /**
   * Create a new topic
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        duration: z.number().min(3600).max(604800), // 1 hour to 7 days
        freezeWindow: z.number().min(60).max(3600), // 1 min to 1 hour
        curatedLimit: z.number().min(10).max(100),
        spaceId: z.number(),
        ipfsHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creator = ctx.userAddress;

      // Check VP balance (10,000 VP)
      const creationCost = BigInt(10000) * BigInt(10 ** 18);
      const balance = await vpBalanceStore.getEffectiveBalance(creator);
      if (balance < creationCost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient VP",
        });
      }

      const space = await topicStore.getSpace(input.spaceId);
      if (!space) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space not found",
        });
      }

      // Create topic
      const topic = await topicStore.create({
        title: input.title,
        description: input.description,
        creator,
        duration: input.duration,
        freezeWindow: input.freezeWindow,
        curatedLimit: input.curatedLimit,
        spaceId: input.spaceId,
        ipfsHash: input.ipfsHash,
      });

      await vpBalanceStore.deductBalance(creator, creationCost);

      // Record VP consumption for topic creation
      await vpStore.record(
        topic.id,
        creator,
        creationCost,
        VpAction.CREATE_TOPIC,
      );

      return {
        topic,
        vpCost: creationCost.toString(),
      };
    }),

  /**
   * Get topic by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const topic = await topicStore.get(input.id);
      if (!topic) {
        throw new Error("Topic not found");
      }

      return {
        ...topic,
        isFrozen: topicStore.isFrozen(topic),
        isExpired: topicStore.isExpired(topic),
      };
    }),

  /**
   * List topics
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.nativeEnum(TopicStatus).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { topics, total } = await topicStore.list(
        input.status,
        input.limit,
        input.offset,
      );
      return { topics, total };
    }),

  /**
   * Close topic (if expired)
   */
  close: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.id);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can close",
        });
      }
      if (!topicStore.isExpired(topic)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic not expired yet",
        });
      }

      await topicStore.updateStatus(input.id, TopicStatus.CLOSED);
      return { success: true };
    }),

  land: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.id);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can land",
        });
      }
      if (topic.status !== TopicStatus.CLOSED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Topic must be closed first",
        });
      }

      await topicStore.updateStatus(input.id, TopicStatus.LANDED);
      return { success: true };
    }),
});
