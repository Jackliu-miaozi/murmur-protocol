import { topicRouter } from "@/server/api/routers/topic";
import { messageRouter } from "@/server/api/routers/message";
import { settlementRouter } from "@/server/api/routers/settlement";
import { vpRouter } from "@/server/api/routers/vp";
import { spaceRouter } from "@/server/api/routers/space";
import { opengovRouter } from "@/server/api/routers/opengov";
import { adminRouter } from "@/server/api/routers/admin";
import { withdrawRouter } from "@/server/api/routers/withdraw";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * Murmur Protocol API Router
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  topic: topicRouter,
  message: messageRouter,
  settlement: settlementRouter,
  vp: vpRouter,
  space: spaceRouter,
  opengov: opengovRouter,
  admin: adminRouter,
  withdraw: withdrawRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.topic.list({ status: "live" });
 */
export const createCaller = createCallerFactory(appRouter);
