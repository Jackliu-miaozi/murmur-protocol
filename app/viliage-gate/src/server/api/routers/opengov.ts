import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { topicStore } from "@/server/murmur/store";
import { TRPCError } from "@trpc/server";
import { keccak256, toHex } from "viem";

const reportHashFromData = (data: unknown) =>
  keccak256(toHex(JSON.stringify(data)));

export const opengovRouter = createTRPCRouter({
  generateReport: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        summary: z.string().max(4000),
        sentimentScore: z.number().min(0).max(1),
        curatedMessageIds: z.array(z.number()).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can generate report",
        });
      }

      const reportHash = reportHashFromData({
        topicId: input.topicId,
        summary: input.summary,
        sentimentScore: input.sentimentScore,
        curatedMessageIds: input.curatedMessageIds,
      });

      await topicStore.createOpenGovReport({
        topicId: input.topicId,
        summary: input.summary,
        sentimentScore: input.sentimentScore,
        curatedMessageIds: input.curatedMessageIds,
        reportHash,
      });

      const updated = await topicStore.updateOpenGovReport(
        input.topicId,
        reportHash,
      );

      return {
        topic: updated,
        reportHash,
      };
    }),

  markSubmitted: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        proposalId: z.string().max(100),
        txHash: z.string().max(66),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can submit",
        });
      }
      if (!topic.openGovReportHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Report must be generated first",
        });
      }

      const updated = await topicStore.updateOpenGovStatus(input.topicId, {
        status: "IN_REFERENDUM",
        proposalId: input.proposalId,
        txHash: input.txHash,
        submittedAt: new Date(),
      });

      return { topic: updated };
    }),

  getReport: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can access report",
        });
      }

      const report = await topicStore.getOpenGovReport(input.topicId);
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      return {
        report: {
          ...report,
          curatedMessageIds: JSON.parse(report.curatedMessageIds),
        },
      };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        status: z.enum(["APPROVED", "REJECTED", "EXECUTED", "READY", "DRAFT"]),
        txHash: z.string().max(66).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await topicStore.get(input.topicId);
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }
      if (topic.creator !== ctx.userAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creator can update status",
        });
      }

      const updated = await topicStore.updateOpenGovStatus(input.topicId, {
        status: input.status,
        txHash: input.txHash,
      });

      return { topic: updated };
    }),
});
