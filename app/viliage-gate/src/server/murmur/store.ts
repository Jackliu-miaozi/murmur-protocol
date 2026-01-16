/**
 * Murmur Protocol - Database Store (Prisma + Supabase)
 * Production-ready data access layer
 */
import { prisma } from "@/server/db";
import { TopicStatus, VpAction, type Prisma } from "@prisma/client";
import { keccak256, toHex } from "viem";

export { TopicStatus, VpAction };

// Re-export Prisma types for convenience
export type Topic = Prisma.TopicGetPayload<object>;
export type Message = Prisma.MessageGetPayload<object>;
export type VpConsumption = Prisma.VpConsumptionGetPayload<object>;
export type CuratedList = Prisma.CuratedListGetPayload<object>;

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
    vpCost: number;
  }) {
    const message = await prisma.message.create({ data });

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
    const result = await prisma.vpConsumption.groupBy({
      by: ["userAddress"],
      where: { settled: false },
      _sum: { amount: true },
    });

    const aggregated = new Map<string, bigint>();
    for (const row of result) {
      if (row._sum.amount) {
        aggregated.set(row.userAddress, BigInt(row._sum.amount.toString()));
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
    if (!topic) return;

    // Check if topic is frozen
    if (topicStore.isFrozen(topic)) return;

    // Get current curated list
    const currentList = await prisma.curatedList.findMany({
      where: { topicId },
      orderBy: { rank: "asc" },
    });

    // Check if message is already in list
    const existing = currentList.find((c) => c.messageId === messageId);
    if (existing) return; // Already in list

    if (likeCount === 0) return; // No likes, don't add

    if (currentList.length < topic.curatedLimit) {
      // List not full, add directly
      await prisma.curatedList.create({
        data: {
          topicId,
          messageId,
          rank: currentList.length + 1,
        },
      });
    } else {
      // List full, check if this message should replace the lowest
      const minEntry = currentList[currentList.length - 1];
      if (!minEntry) return;

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
      }
    }

    // Re-rank based on like count
    await this.rerank(topicId);
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
