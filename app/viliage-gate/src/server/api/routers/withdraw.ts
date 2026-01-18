import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { vpBalanceStore, withdrawalStore } from "@/server/murmur/store";
import { getUserNonce } from "@/server/murmur/chain";
import { signatureService } from "@/server/murmur/signature";
import { TRPCError } from "@trpc/server";
import { type Hex } from "viem";

export const withdrawRouter = createTRPCRouter({
  signWithdraw: protectedProcedure
    .input(
      z.object({
        vpBurnAmount: z.string(),
        vdotReturn: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const burnAmount = BigInt(input.vpBurnAmount);
      const vdotReturn = BigInt(input.vdotReturn);

      const balance = await vpBalanceStore.getEffectiveBalance(ctx.userAddress);
      if (balance < burnAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient VP",
        });
      }

      const nonce = await getUserNonce(ctx.userAddress as Hex);

      const signature = await signatureService.signWithdraw(
        ctx.userAddress as Hex,
        burnAmount,
        vdotReturn,
        nonce,
      );

      const request = await withdrawalStore.create({
        userAddress: ctx.userAddress,
        vpBurnAmount: input.vpBurnAmount,
        vdotReturn: input.vdotReturn,
        signature,
        nonce: Number(nonce),
      });

      return {
        signature,
        nonce: nonce.toString(),
        requestId: request.id,
      };
    }),
});
