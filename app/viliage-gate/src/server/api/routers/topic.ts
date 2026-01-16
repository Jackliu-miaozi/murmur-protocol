/**
 * Murmur Protocol - Topic Router (Prisma + Supabase)
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  topicStore,
  vpStore,
  TopicStatus,
  VpAction,
} from "@/server/murmur/store";

export const topicRouter = createTRPCRouter({
  /**
   * Create a new topic
   */
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        duration: z.number().min(3600).max(604800), // 1 hour to 7 days
        freezeWindow: z.number().min(60).max(3600), // 1 min to 1 hour
        curatedLimit: z.number().min(10).max(100),
        creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      }),
    )
    .mutation(async ({ input }) => {
      // Create topic
      const topic = await topicStore.create({
        title: input.title,
        description: input.description,
        creator: input.creator.toLowerCase(),
        duration: input.duration,
        freezeWindow: input.freezeWindow,
        curatedLimit: input.curatedLimit,
      });

      // Record VP consumption for topic creation (1000 VP base cost)
      const creationCost = BigInt(1000) * BigInt(10 ** 18);
      await vpStore.record(
        topic.id,
        input.creator,
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
  close: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const topic = await topicStore.get(input.id);
      if (!topic) {
        throw new Error("Topic not found");
      }
      if (!topicStore.isExpired(topic)) {
        throw new Error("Topic not expired yet");
      }

      await topicStore.updateStatus(input.id, TopicStatus.CLOSED);
      return { success: true };
    }),
});
