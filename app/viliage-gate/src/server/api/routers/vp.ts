import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { vpBalanceStore } from "@/server/murmur/store";

export const vpRouter = createTRPCRouter({
  getBalance: publicProcedure
    .input(z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }))
    .query(async ({ input }) => {
      const balance = await vpBalanceStore.getEffectiveBalance(input.address);
      return { balance: balance.toString() };
    }),

  syncBalance: protectedProcedure.mutation(async ({ ctx }) => {
    const balance = await vpBalanceStore.syncFromChain(ctx.userAddress);
    return { balance: balance.toString(), synced: true };
  }),
});
