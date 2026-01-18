/**
 * Murmur Protocol - Database Store (Prisma + Supabase)
 * Production-ready data access layer
 */
import { prisma } from "@/server/db";
import { Prisma, RewardSource, TopicStatus, VpAction } from "@prisma/client";
import { keccak256, toHex } from "viem";
import {
  calculateVp,
  getStakedVdot,
  getVpBalance,
  type Address,
} from "./chain";

export { TopicStatus, VpAction };

// Re-export Prisma types for convenience
export type Topic = Prisma.TopicGetPayload<object>;
export type Message = Prisma.MessageGetPayload<object>;
export type VpConsumption = Prisma.VpConsumptionGetPayload<object>;
export type CuratedList = Prisma.CuratedListGetPayload<object>;
export type VpReward = Prisma.VpRewardGetPayload<object>;
export type OpenGovReport = Prisma.OpenGovReportGetPayload<object>;

/**
 * Topic Store
 */
export const topicStore = {
  async create(data: {
    title: string;
    description: string;
    creator: string;
    duration: number;
    freezeWindow: number;
    curatedLimit: number;
    spaceId?: number;
    ipfsHash?: string;
  }) {
    const metadata = JSON.stringify({
      title: data.title,
      description: data.description,
      creator: data.creator,
      createdAt: new Date().toISOString(),
    });
    const metadataHash = keccak256(toHex(metadata));

    return prisma.topic.create({
      data: {
        ...data,
        metadataHash,
        status: TopicStatus.LIVE,
      },
    });
  },

  async get(id: number) {
    return prisma.topic.findUnique({
      where: { id },
    });
  },

  async getSpace(spaceId: number) {
    return prisma.space.findUnique({
      where: { id: spaceId },
    });
  },

  async list(status?: TopicStatus, limit = 20, offset = 0) {
    const where = status ? { status } : {};
    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.topic.count({ where }),
    ]);
    return { topics, total };
  },

  async updateStatus(id: number, status: TopicStatus) {
    return prisma.topic.update({
      where: { id },
      data: { status },
    });
  },

  async updateOpenGovReport(id: number, reportHash: string) {
    return prisma.topic.update({
      where: { id },
      data: {
        openGovReportHash: reportHash,
        openGovStatus: "READY",
      },
    });
  },

  async updateOpenGovStatus(
    id: number,
    data: {
      status: "IN_REFERENDUM" | "APPROVED" | "REJECTED" | "EXECUTED" | "READY" | "DRAFT";
      proposalId?: string;
      txHash?: string;
      submittedAt?: Date;
    },
  ) {
    return prisma.topic.update({
      where: { id },
      data: {
        openGovStatus: data.status,
        openGovProposalId: data.proposalId,
        openGovTxHash: data.txHash,
        openGovSubmittedAt: data.submittedAt,
      },
    });
  },

  async createOpenGovReport(data: {
    topicId: number;
    summary: string;
    sentimentScore: number;
    curatedMessageIds: number[];
    reportHash: string;
  }) {
    return prisma.openGovReport.upsert({
      where: { topicId: data.topicId },
      create: {
        topicId: data.topicId,
        summary: data.summary,
        sentimentScore: data.sentimentScore,
        curatedMessageIds: JSON.stringify(data.curatedMessageIds),
        reportHash: data.reportHash,
      },
      update: {
        summary: data.summary,
        sentimentScore: data.sentimentScore,
        curatedMessageIds: JSON.stringify(data.curatedMessageIds),
        reportHash: data.reportHash,
      },
    });
  },

  async getOpenGovReport(topicId: number) {
    return prisma.openGovReport.findUnique({
      where: { topicId },
    });
  },

  async incrementMessageCount(id: number) {
    return prisma.topic.update({
      where: { id },
      data: { messageCount: { increment: 1 } },
    });
  },

  async incrementUniqueUsers(id: number) {
    return prisma.topic.update({
      where: { id },
      data: { uniqueUsers: { increment: 1 } },
    });
  },

  isFrozen(topic: Topic): boolean {
    if (topic.status !== TopicStatus.LIVE) return false;
    const elapsed = (Date.now() - topic.createdAt.getTime()) / 1000;
    return elapsed >= topic.duration - topic.freezeWindow;
  },

  isExpired(topic: Topic): boolean {
    if (topic.status !== TopicStatus.LIVE) return false;
    const elapsed = (Date.now() - topic.createdAt.getTime()) / 1000;
    return elapsed >= topic.duration;
  },
};

/**
 * Message Store
 */
export const messageStore = {
  async create(data: {
    topicId: number;
    author: string;
    content: string;
    contentHash: string;
    length: number;
    aiScore: number;
    vpCost: bigint;
  }) {
    const message = await prisma.message.create({
      data: {
        ...data,
        vpCost: data.vpCost.toString(),
      },
    });

    // Update topic stats
    await topicStore.incrementMessageCount(data.topicId);

    // Check if this is a new unique user
    const existingMessages = await prisma.message.count({
      where: {
        topicId: data.topicId,
        author: data.author,
      },
    });
    if (existingMessages === 1) {
      await topicStore.incrementUniqueUsers(data.topicId);
    }

    return message;
  },

  async get(id: number) {
    return prisma.message.findUnique({
      where: { id },
    });
  },

  async listByTopic(topicId: number, limit = 50, offset = 0) {
    return prisma.message.findMany({
      where: { topicId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  },

  async like(messageId: number) {
    return prisma.message.update({
      where: { id: messageId },
      data: { likeCount: { increment: 1 } },
    });
  },

  async hasUserPosted(topicId: number, userAddress: string) {
    const count = await prisma.message.count({
      where: {
        topicId,
        author: userAddress.toLowerCase(),
      },
    });
    return count > 0;
  },
};

/**
 * VP Consumption Store
 */
export const vpStore = {
  async record(
    topicId: number,
    userAddress: string,
    amount: bigint,
    action: VpAction,
  ) {
    return prisma.vpConsumption.create({
      data: {
        topicId,
        userAddress: userAddress.toLowerCase(),
        amount: amount.toString(), // Decimal field
        action,
        settled: false,
      },
    });
  },

  async getUnsettled() {
    return prisma.vpConsumption.findMany({
      where: { settled: false },
    });
  },

  async getUnprocessedRewards() {
    return prisma.vpReward.findMany({
      where: { processed: false },
    });
  },

  async getByTopic(topicId: number) {
    return prisma.vpConsumption.findMany({
      where: { topicId },
    });
  },

  async getByUser(userAddress: string) {
    return prisma.vpConsumption.findMany({
      where: { userAddress: userAddress.toLowerCase() },
    });
  },

  async markSettled(ids: number[], settlementId: number) {
    return prisma.vpConsumption.updateMany({
      where: { id: { in: ids } },
      data: { settled: true, settlementId },
    });
  },

  /**
   * Aggregate unsettled VP by user for batch settlement
   */
  async aggregateUnsettled() {
    const [consumptions, rewards] = await Promise.all([
      prisma.vpConsumption.groupBy({
        by: ["userAddress"],
        where: { settled: false },
        _sum: { amount: true },
      }),
      prisma.vpReward.groupBy({
        by: ["userAddress"],
        where: { processed: false },
        _sum: { amount: true },
      }),
    ]);

    const aggregated = new Map<string, bigint>();

    for (const row of consumptions) {
      if (row._sum.amount) {
        const current = aggregated.get(row.userAddress) ?? 0n;
        aggregated.set(row.userAddress, current - BigInt(row._sum.amount.toString()));
      }
    }

    for (const row of rewards) {
      if (row._sum.amount) {
        const current = aggregated.get(row.userAddress) ?? 0n;
        aggregated.set(row.userAddress, current + BigInt(row._sum.amount.toString()));
      }
    }

    return aggregated;
  },

  /**
   * Get refund data for a topic (all users and their total VP)
   */
  async getRefundData(topicId: number) {
    const result = await prisma.vpConsumption.groupBy({
      by: ["userAddress"],
      where: { topicId },
      _sum: { amount: true },
    });

    const users: string[] = [];
    const amounts: bigint[] = [];
    for (const row of result) {
      if (row._sum.amount) {
        users.push(row.userAddress);
        amounts.push(BigInt(row._sum.amount.toString()));
      }
    }
    return { users, amounts };
  },
};

/**
 * Curation Store
 */
export const curationStore = {
  async update(topicId: number, messageId: number, likeCount: number) {
    const topic = await topicStore.get(topicId);
    if (!topic) return { added: false };

    // Check if topic is frozen
    if (topicStore.isFrozen(topic)) return { added: false };

    // Get current curated list
    const currentList = await prisma.curatedList.findMany({
      where: { topicId },
      orderBy: { rank: "asc" },
    });

    // Check if message is already in list
    const existing = currentList.find((c) => c.messageId === messageId);
    if (existing) return { added: false };

    if (likeCount === 0) return { added: false }; // No likes, don't add

    if (currentList.length < topic.curatedLimit) {
      // List not full, add directly
      await prisma.curatedList.create({
        data: {
          topicId,
          messageId,
          rank: currentList.length + 1,
        },
      });
      await this.rerank(topicId);
      return { added: true };
    }

    // List full, check if this message should replace the lowest
    const minEntry = currentList[currentList.length - 1];
    if (!minEntry) return { added: false };

    const minMessage = await prisma.message.findUnique({
      where: { id: minEntry.messageId },
    });

    if (minMessage && likeCount > minMessage.likeCount) {
      // Replace the lowest
      await prisma.curatedList.delete({
        where: { id: minEntry.id },
      });
      await prisma.curatedList.create({
        data: {
          topicId,
          messageId,
          rank: topic.curatedLimit,
        },
      });
      await this.rerank(topicId);
      return { added: true };
    }

    return { added: false };
  },

  async rerank(topicId: number) {
    const entries = await prisma.curatedList.findMany({
      where: { topicId },
      include: { message: true },
    });

    // Sort by like count descending
    entries.sort((a, b) => b.message.likeCount - a.message.likeCount);

    // Update ranks
    for (let i = 0; i < entries.length; i++) {
      await prisma.curatedList.update({
        where: { id: entries[i]!.id },
        data: { rank: i + 1 },
      });
    }
  },

  async get(topicId: number) {
    return prisma.curatedList.findMany({
      where: { topicId },
      orderBy: { rank: "asc" },
      include: { message: true },
    });
  },

  async getCuratedHash(topicId: number): Promise<string> {
    const curated = await this.get(topicId);
    const sortedIds = curated.map((c) => c.messageId);
    return keccak256(toHex(JSON.stringify(sortedIds)));
  },
};

/**
 * VP Balance Store
 */
export const vpBalanceStore = {
  async getEffectiveBalance(userAddress: string): Promise<bigint> {
    const address = userAddress.toLowerCase();
    await this.applyRespiration(address);

    const user = await prisma.user.findUnique({
      where: { address },
      select: { vpBalance: true },
    });

    if (!user) {
      return this.syncFromChain(address);
    }

    return BigInt(user.vpBalance.toString());
  },

  async syncFromChain(userAddress: string): Promise<bigint> {
    const address = userAddress.toLowerCase();
    const onChainBalance = await getVpBalance(address as Address);
    const stakedVdot = await getStakedVdot(address as Address);
    const maxVp = await calculateVp(stakedVdot);

    await prisma.user.upsert({
      where: { address },
      create: {
        address,
        vdotBalance: stakedVdot.toString(),
        vpBalance: onChainBalance.toString(),
        maxVp: maxVp.toString(),
        lastRespiration: new Date(),
      },
      update: {
        vdotBalance: stakedVdot.toString(),
        vpBalance: onChainBalance.toString(),
        maxVp: maxVp.toString(),
        lastRespiration: new Date(),
      },
    });

    return onChainBalance;
  },

  async deductBalance(userAddress: string, amount: bigint): Promise<void> {
    await prisma.user.update({
      where: { address: userAddress.toLowerCase() },
      data: {
        vpBalance: { decrement: amount.toString() },
      },
    });
  },

  async applyRespiration(userAddress: string): Promise<bigint> {
    const address = userAddress.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { address },
      select: {
        vpBalance: true,
        maxVp: true,
        lastRespiration: true,
      },
    });

    if (!user) return 0n;

    const maxVp = BigInt(user.maxVp.toString());
    const currentVp = BigInt(user.vpBalance.toString());
    if (maxVp === 0n) return 0n;

    const hoursSince =
      (Date.now() - user.lastRespiration.getTime()) / 3_600_000;
    if (hoursSince <= 0) return 0n;

    const rate = parseFloat(process.env.RESPIRATION_RATE || "0.05");
    const recoverable = BigInt(Math.floor(hoursSince * rate * 100)) * maxVp / 100n;
    const deficit = maxVp - currentVp;
    const toRecover = recoverable < deficit ? recoverable : deficit;

    if (toRecover > 0n) {
      await prisma.user.update({
        where: { address },
        data: {
          vpBalance: { increment: toRecover.toString() },
          lastRespiration: new Date(),
        },
      });
    }

    return toRecover;
  },
};

/**
 * VP Reward Store
 */
export const vpRewardStore = {
  async grantResonanceBonus(
    messageId: number,
    likerAddress: string,
  ): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { author: true, vpCost: true },
    });

    if (!message) return;

    const rate = parseFloat(process.env.LIKE_RESONANCE_RATE || "0.1");
    const cost = BigInt(message.vpCost.toString());
    const bonus = (cost * BigInt(Math.round(rate * 100))) / 100n;

    if (bonus <= 0n) return;

    try {
      await prisma.$transaction([
        prisma.vpReward.create({
          data: {
            userAddress: message.author,
            amount: bonus.toString(),
            source: RewardSource.LIKE_EARNED,
            referenceId: `like:${messageId}:${likerAddress.toLowerCase()}`,
          },
        }),
        prisma.user.update({
          where: { address: message.author },
          data: { vpBalance: { increment: bonus.toString() } },
        }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }
      throw error;
    }
  },

  async grantCuratedBonus(topicId: number, messageId: number): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { author: true },
    });

    if (!message) return;

    const bonus = BigInt(
      process.env.CURATED_BONUS_VP || "500000000000000000000",
    );

    try {
      await prisma.$transaction([
        prisma.vpReward.create({
          data: {
            userAddress: message.author,
            amount: bonus.toString(),
            source: RewardSource.CURATED_BONUS,
            referenceId: `topic:${topicId}:msg:${messageId}`,
          },
        }),
        prisma.user.update({
          where: { address: message.author },
          data: { vpBalance: { increment: bonus.toString() } },
        }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }
      throw error;
    }
  },

  async getPendingRewards() {
    return prisma.vpReward.findMany({
      where: { processed: false },
    });
  },

  async markProcessed(ids: number[]) {
    if (ids.length === 0) return;
    await prisma.vpReward.updateMany({
      where: { id: { in: ids } },
      data: { processed: true },
    });
  },
};

/**
 * Like Store
 */
export const likeStore = {
  async create(messageId: number, userAddress: string) {
    return prisma.like.create({
      data: {
        messageId,
        userId: userAddress.toLowerCase(),
      },
    });
  },
};

/**
 * Settlement Store
 */
export const settlementStore = {
  async create(nonce: number, type: "BATCH_BURN" | "BATCH_MINT") {
    return prisma.settlement.create({
      data: {
        nonce,
        type,
        status: "PENDING",
      },
    });
  },

  async getOrCreate(nonce: number, type: "BATCH_BURN" | "BATCH_MINT") {
    return prisma.settlement.upsert({
      where: { nonce },
      create: {
        nonce,
        type,
        status: "PENDING",
      },
      update: {},
    });
  },

  async confirm(id: number, txHash: string) {
    return prisma.settlement.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        txHash,
        confirmedAt: new Date(),
      },
    });
  },

  async getNextNonce() {
    const last = await prisma.settlement.findFirst({
      orderBy: { nonce: "desc" },
    });
    return last ? last.nonce + 1 : 0;
  },

  async getLatest() {
    return prisma.settlement.findFirst({
      orderBy: { createdAt: "desc" },
    });
  },
};

export const topicStatsStore = {
  async countByStatus() {
    const result = await prisma.topic.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const stats: Record<string, number> = {};
    for (const row of result) {
      stats[row.status] = row._count.status;
    }

    return stats;
  },
};

/**
 * Minted NFT Store
 */
export const mintedNFTStore = {
  async create(data: {
    topicId: number;
    tokenId: number;
    topicHash: string;
    curatedHash: string;
    minter: string;
    txHash?: string;
  }) {
    return prisma.mintedNFT.create({ data });
  },

  async getByTopic(topicId: number) {
    return prisma.mintedNFT.findUnique({
      where: { topicId },
    });
  },
};

/**
 * Space Store
 */
export const spaceStore = {
  async create(data: {
    name: string;
    owner: string;
    twitterHandle?: string;
    description?: string;
  }) {
    return prisma.space.create({
      data: {
        name: data.name,
        owner: data.owner.toLowerCase(),
        twitterHandle: data.twitterHandle,
        description: data.description,
      },
    });
  },

  async get(id: number) {
    return prisma.space.findUnique({
      where: { id },
    });
  },

  async list(limit = 20, offset = 0) {
    const [spaces, total] = await Promise.all([
      prisma.space.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.space.count(),
    ]);
    return { spaces, total };
  },

  async listTopics(spaceId: number, limit = 20, offset = 0) {
    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        where: { spaceId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.topic.count({ where: { spaceId } }),
    ]);
    return { topics, total };
  },
};

/**
 * Withdrawal Store
 */
export const withdrawalStore = {
  async create(data: {
    userAddress: string;
    vpBurnAmount: string;
    vdotReturn: string;
    signature: string;
    nonce: number;
  }) {
    return prisma.withdrawalRequest.create({
      data: {
        userAddress: data.userAddress.toLowerCase(),
        vpBurnAmount: data.vpBurnAmount,
        vdotReturn: data.vdotReturn,
        signature: data.signature,
        nonce: data.nonce,
        status: "PENDING",
      },
    });
  },

  async updateStatus(id: number, status: "PENDING" | "COMPLETED" | "FAILED") {
    return prisma.withdrawalRequest.update({
      where: { id },
      data: { status },
    });
  },
};
