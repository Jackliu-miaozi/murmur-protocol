import { topicRouter } from "@/server/api/routers/topic";
import { messageRouter } from "@/server/api/routers/message";
import { settlementRouter } from "@/server/api/routers/settlement";
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
