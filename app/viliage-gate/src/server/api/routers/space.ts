import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { spaceStore } from "@/server/murmur/store";
import { TRPCError } from "@trpc/server";

export const spaceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        twitterHandle: z.string().max(50).optional(),
        description: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const space = await spaceStore.create({
          name: input.name,
          owner: ctx.userAddress,
          twitterHandle: input.twitterHandle,
          description: input.description,
        });
        return { space };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Space already exists",
        });
      }
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const space = await spaceStore.get(input.id);
      if (!space) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      }
      return { space };
    }),

  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { spaces, total } = await spaceStore.list(
        input.limit,
        input.offset,
      );
      return { spaces, total };
    }),

  listTopics: publicProcedure
    .input(
      z.object({
        spaceId: z.number(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { topics, total } = await spaceStore.listTopics(
        input.spaceId,
        input.limit,
        input.offset,
      );
      return { topics, total };
    }),
});
