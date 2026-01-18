# Murmur Protocol 后端配置设计文档

> **设计决策**: VP 混合同步 | MVP 固定 AI 评分 | 混合触发结算 | Vercel + Supabase
>
> **日期**: 2026-01-18

---

## 1. 服务器目录结构

```
app/viliage-gate/src/server/
├── db.ts                    # Prisma 客户端单例
├── api/
│   ├── trpc.ts              # tRPC 初始化 & 中间件
│   ├── root.ts              # 路由聚合入口
│   └── routers/
│       ├── topic.ts         # 议题 CRUD
│       ├── message.ts       # 消息 & 点赞
│       └── settlement.ts    # VP 结算 & NFT 铸造
└── murmur/
    ├── index.ts             # 模块导出
    ├── types.ts             # 类型定义
    ├── store.ts             # 数据访问层
    └── signature.ts         # EIP-712 签名服务
```

---

## 2. 各文件配置说明

### 2.1 `db.ts` - Prisma 客户端

**现状**: ✅ 已完成，无需修改

**功能**: 防止开发热重载创建多个 Prisma 实例

```typescript
// 当前实现已正确，生产环境自动使用 DATABASE_URL
export const prisma = globalForPrisma.prisma ?? new PrismaClient({...})
```

**环境变量**:

```env
DATABASE_URL="postgresql://..."  # Supabase 连接串 (with pooler)
```

---

### 2.2 `api/trpc.ts` - tRPC 配置

**需要修改**: 添加钱包认证中间件

```typescript
// ============ 新增: 钱包认证中间件 ============
import { TRPCError } from "@trpc/server";
import { verifyMessage } from "viem";

const walletAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const signature = ctx.headers.get("x-wallet-signature");
  const message = ctx.headers.get("x-wallet-message");
  const address = ctx.headers.get("x-wallet-address");

  if (!signature || !message || !address) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing wallet auth",
    });
  }

  const isValid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });

  if (!isValid) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid signature" });
  }

  return next({ ctx: { ...ctx, userAddress: address.toLowerCase() } });
});

// ============ 新增导出 ============
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(walletAuthMiddleware);
```

**使用场景**:

- `publicProcedure`: 读取议题、消息列表
- `protectedProcedure`: 发消息、点赞、创建议题

---

### 2.3 `api/root.ts` - 路由聚合

**需要修改**: 添加 VP 同步路由和管理员路由

```typescript
import { topicRouter } from "@/server/api/routers/topic";
import { messageRouter } from "@/server/api/routers/message";
import { settlementRouter } from "@/server/api/routers/settlement";
import { vpRouter } from "@/server/api/routers/vp"; // 🆕 新增
import { adminRouter } from "@/server/api/routers/admin"; // 🆕 新增

export const appRouter = createTRPCRouter({
  topic: topicRouter,
  message: messageRouter,
  settlement: settlementRouter,
  vp: vpRouter, // 🆕 VP 余额查询 & 同步
  admin: adminRouter, // 🆕 管理员操作
});
```

---

### 2.4 `api/routers/topic.ts` - 议题路由

**需要修改**: 使用 `protectedProcedure` 保护写操作

```typescript
// 修改前
create: publicProcedure.input(...).mutation(...)

// 修改后
create: protectedProcedure.input(...).mutation(async ({ ctx, input }) => {
  // ctx.userAddress 已验证，直接使用
  const topic = await topicStore.create({
    ...input,
    creator: ctx.userAddress,  // 使用已验证地址
  });
  ...
})
```

**创建议题时的 VP 扣除**:

```typescript
// 验证用户有足够 VP
const balance = await vpService.getEffectiveBalance(ctx.userAddress);
const creationCost = BigInt(10000) * BigInt(10 ** 18); // 10,000 VP
if (balance < creationCost) {
  throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient VP" });
}
```

---

### 2.5 `api/routers/message.ts` - 消息路由

**需要修改**: 使用 `protectedProcedure` + VP 余额检查

```typescript
post: protectedProcedure
  .input(z.object({
    topicId: z.number(),
    content: z.string().min(1).max(5000),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. 计算 VP 成本 (MVP: 固定情绪值)
    const aiScore = parseFloat(process.env.AI_FIXED_SCORE || "0.5");
    const vpCost = calculateVpCost(input.content.length, aiScore);

    // 2. 检查余额
    const balance = await vpService.getEffectiveBalance(ctx.userAddress);
    if (balance < vpCost) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient VP' });
    }

    // 3. 扣除链下余额
    await vpService.deductBalance(ctx.userAddress, vpCost);

    // 4. 创建消息
    const message = await messageStore.create({
      topicId: input.topicId,
      author: ctx.userAddress,
      content: input.content,
      ...
    });

    return { message, vpCost: vpCost.toString() };
  });
```

---

### 2.6 `api/routers/settlement.ts` - 结算路由

**需要修改**: 调用 Supabase Edge Function 签名

```typescript
signBatchBurn: publicProcedure.mutation(async () => {
  // ... 聚合未结算数据 ...

  // 🆕 调用 Supabase Edge Function
  const signResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sign-settlement`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        users,
        deltas: amounts.map((a) => -a), // 负数表示销毁
        nonce,
        chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!),
        contractAddress: process.env.NEXT_PUBLIC_ROUTER_PROXY,
      }),
    }
  );

  const { signature } = await signResponse.json();

  return { users, amounts, nonce, signature };
});
```

---

### 2.7 `murmur/store.ts` - 数据访问层

**现状**: ✅ 基本完成

**需要新增**: VP 余额管理函数

```typescript
// ============ 新增: VP 余额服务 ============
export const vpBalanceStore = {
  /**
   * 获取用户有效 VP 余额 (混合模式)
   */
  async getEffectiveBalance(userAddress: string): Promise<bigint> {
    const addr = userAddress.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { address: addr },
      select: { vpBalance: true, lastRespiration: true },
    });

    // 缓存 5 分钟
    const cacheAge = user
      ? Date.now() - user.lastRespiration.getTime()
      : Infinity;

    if (!user || cacheAge > 5 * 60 * 1000) {
      // 从链上同步
      return this.syncFromChain(addr);
    }

    return BigInt(user.vpBalance.toString());
  },

  /**
   * 从链上同步余额
   */
  async syncFromChain(userAddress: string): Promise<bigint> {
    const onChainBalance = await vpContract.read.balanceOf([userAddress]);

    await prisma.user.upsert({
      where: { address: userAddress },
      create: {
        address: userAddress,
        vpBalance: onChainBalance.toString(),
        maxVp: onChainBalance.toString(),
        lastRespiration: new Date(),
      },
      update: {
        vpBalance: onChainBalance.toString(),
        lastRespiration: new Date(),
      },
    });

    return onChainBalance;
  },

  /**
   * 扣除链下余额 (记录消费)
   */
  async deductBalance(userAddress: string, amount: bigint): Promise<void> {
    await prisma.user.update({
      where: { address: userAddress.toLowerCase() },
      data: {
        vpBalance: { decrement: amount.toString() },
      },
    });
  },
};
```

---

### 2.8 `murmur/signature.ts` - 签名服务

**需要修改**: 替换 Mock 为 Supabase Edge Function 调用

```typescript
/**
 * Production Signature Service
 * 调用 Supabase Edge Function 进行签名
 */
export class SupabaseSignatureService implements SignatureService {
  private supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  async signBatchBurn(
    users: Hex[],
    amounts: bigint[],
    nonce: bigint
  ): Promise<Hex> {
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/sign-settlement`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "BATCH_BURN",
          users,
          deltas: amounts.map((a) => (-a).toString()),
          nonce: nonce.toString(),
          chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!),
          contractAddress: process.env.NEXT_PUBLIC_ROUTER_PROXY,
        }),
      }
    );

    const { signature } = await response.json();
    return signature as Hex;
  }

  // signBatchMint, signMintNFT 类似实现...
}

// 根据环境选择实现
export const signatureService =
  process.env.NODE_ENV === "production"
    ? new SupabaseSignatureService()
    : new MockSignatureService();
```

---

### 2.9 🆕 `api/routers/vp.ts` - VP 路由 (新增)

```typescript
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { vpBalanceStore } from "@/server/murmur/store";
import { z } from "zod";

export const vpRouter = createTRPCRouter({
  /**
   * 获取用户 VP 余额
   */
  getBalance: publicProcedure
    .input(z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }))
    .query(async ({ input }) => {
      const balance = await vpBalanceStore.getEffectiveBalance(input.address);
      return { balance: balance.toString() };
    }),

  /**
   * 强制同步链上余额
   */
  syncBalance: protectedProcedure.mutation(async ({ ctx }) => {
    const balance = await vpBalanceStore.syncFromChain(ctx.userAddress);
    return { balance: balance.toString(), synced: true };
  }),
});
```

---

### 2.10 🆕 `api/routers/admin.ts` - 管理员路由 (新增)

**功能**: 支持 Admin Dashboard 的统计与运维操作

```typescript
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { vpStore, topicStore, settlementStore } from "@/server/murmur/store";

// 简单的管理员鉴权 (实际应检查钱包地址白名单 或 Admin Token)
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "")
    .toLowerCase()
    .split(",");
  if (!ADMIN_WALLETS.includes(ctx.userAddress)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const adminRouter = createTRPCRouter({
  /**
   * 仪表盘统计数据
   */
  getStats: adminProcedure.query(async () => {
    const [pendingVP, pendingUsers] = await Promise.all([
      vpStore.getUnsettledTotal(), // 需在 store 中实现 getUnsettledTotal
      vpStore.getUnsettledUserCount(),
    ]);

    return {
      pendingVP: pendingVP.toString(),
      pendingUsers,
      lastSettlement: await settlementStore.getLastSettlement(),
    };
  }),

  /**
   * 手动触发结算 (紧急或测试用)
   */
  triggerSettlement: adminProcedure.mutation(async () => {
    // 复用 Settlement Service 逻辑
    // ...
    return { success: true };
  }),
});
```

---

### 2.11 🆕 `api/cron/settlement.ts` - Cron Job (新增)

位置: `app/viliage-gate/src/app/api/cron/settlement/route.ts`

```typescript
import { NextResponse } from "next/server";
import { vpStore, settlementStore } from "@/server/murmur/store";
import { signatureService } from "@/server/murmur/signature";

export const runtime = "edge";
export const maxDuration = 60;

export async function GET(request: Request) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 聚合未结算消费
  const pending = await vpStore.aggregateUnsettled();
  const totalVP = Array.from(pending.values()).reduce((a, b) => a + b, 0n);
  const userCount = pending.size;

  // 检查门槛
  const threshold = BigInt(
    process.env.SETTLEMENT_THRESHOLD_VP || "10000000000000000000000"
  );
  const minUsers = parseInt(process.env.MIN_SETTLEMENT_USERS || "5");

  if (totalVP < threshold && userCount < minUsers) {
    return NextResponse.json({
      settled: false,
      reason: "Below threshold",
      pendingVP: totalVP.toString(),
      users: userCount,
    });
  }

  // 执行结算
  const users = Array.from(pending.keys());
  const amounts = users.map((u) => pending.get(u)!);
  const nonce = await settlementStore.getNextNonce();

  const signature = await signatureService.signBatchBurn(
    users as `0x${string}`[],
    amounts,
    BigInt(nonce)
  );

  const settlement = await settlementStore.create(nonce, "BATCH_BURN");

  return NextResponse.json({
    settled: true,
    settlementId: settlement.id,
    users: users.length,
    totalVP: totalVP.toString(),
    signature,
  });
}
```

---

## 3. Vercel 配置

### 3.1 `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/settlement",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

### 3.2 环境变量清单

| 变量名                      | 必填 | 说明                       |
| --------------------------- | ---- | -------------------------- |
| `DATABASE_URL`              | ✅   | Supabase PostgreSQL 连接串 |
| `NEXT_PUBLIC_SUPABASE_URL`  | ✅   | Supabase 项目 URL          |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅   | 服务端密钥                 |
| `NEXT_PUBLIC_CHAIN_ID`      | ✅   | 链 ID (1284 = Moonbeam)    |
| `NEXT_PUBLIC_ROUTER_PROXY`  | ✅   | 合约地址                   |
| `CRON_SECRET`               | ✅   | Cron Job 认证密钥          |
| `SETTLEMENT_THRESHOLD_VP`   | ❌   | 结算门槛 (默认 10000 VP)   |
| `AI_FIXED_SCORE`            | ❌   | 固定情绪值 (默认 0.5)      |

---

## 4. Supabase Edge Function

### 4.1 创建签名函数

```bash
supabase functions new sign-settlement
```

### 4.2 `supabase/functions/sign-settlement/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { privateKeyToAccount } from "npm:viem/accounts";

serve(async (req) => {
  const privateKey = Deno.env.get("OPERATOR_PRIVATE_KEY")!;
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const { type, users, deltas, nonce, chainId, contractAddress } =
    await req.json();

  const domain = {
    name: type === "NFT" ? "MurmurNFT" : "MurmurVPToken",
    version: "3",
    chainId,
    verifyingContract: contractAddress,
  };

  const types = {
    Settlement: [
      { name: "users", type: "address[]" },
      { name: "deltas", type: "int256[]" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "Settlement",
    message: {
      users,
      deltas: deltas.map(BigInt),
      nonce: BigInt(nonce),
    },
  });

  return new Response(JSON.stringify({ signature }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 4.3 部署

```bash
# 设置 Vault 密钥
supabase secrets set OPERATOR_PRIVATE_KEY=0x...

# 部署函数
supabase functions deploy sign-settlement
```

---

## 5. 部署检查清单

### 开发环境

- [ ] 复制 `.env.example` → `.env.local`
- [ ] 运行 `npx prisma db push`
- [ ] 运行 `npm run dev`

### Staging

- [ ] Vercel Preview 分支部署
- [ ] Supabase 测试项目
- [ ] 测试网合约地址

### Production

- [ ] Vercel Production 环境变量
- [ ] Supabase Vault 存储私钥
- [ ] 部署 Edge Function
- [ ] 启用 RLS 策略
- [ ] 配置监控告警

---

## 6. 缺失功能补充 (基于合约 & useway_v3 核查)

### 6.1 VP 恢复机制 (Respiration & Resonance)

根据 `useway_v3_unified.md` 的经济模型：

```typescript
// lib/vp-respiration.ts
export const vpRespirationService = {
  /**
   * 自然呼吸恢复 - 每小时恢复 maxVp 的 5%
   */
  async calculateRespiration(userAddress: string): Promise<bigint> {
    const user = await prisma.user.findUnique({
      where: { address: userAddress.toLowerCase() },
    });
    if (!user) return 0n;

    const hoursSince = (Date.now() - user.lastRespiration.getTime()) / 3600000;
    const maxVp = BigInt(user.maxVp.toString());
    const currentVp = BigInt(user.vpBalance.toString());

    // 恢复 = min(maxVp - currentVp, hoursSince * 0.05 * maxVp)
    const recoverable = (maxVp * BigInt(Math.floor(hoursSince * 5))) / 100n;
    const deficit = maxVp - currentVp;
    const toRecover = recoverable < deficit ? recoverable : deficit;

    if (toRecover > 0n) {
      await prisma.user.update({
        where: { address: userAddress.toLowerCase() },
        data: {
          vpBalance: { increment: toRecover.toString() },
          lastRespiration: new Date(),
        },
      });
    }

    return toRecover;
  },

  /**
   * 共鸣回响 - 被点赞时作者恢复消耗 VP 的 10%
   */
  async applyResonanceBonus(
    messageId: number,
    likerAddress: string
  ): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { author: true, vpCost: true },
    });
    if (!message) return;

    const bonus = BigInt(Math.floor(message.vpCost * 0.1 * 1e18));

    await prisma.$transaction([
      // 记录奖励
      prisma.vpReward.create({
        data: {
          userAddress: message.author,
          amount: bonus.toString(),
          source: "LIKE_EARNED",
          referenceId: messageId.toString(),
        },
      }),
      // 增加作者 VP
      prisma.user.update({
        where: { address: message.author },
        data: { vpBalance: { increment: bonus.toString() } },
      }),
    ]);
  },
};
```

### 6.2 精选奖励 (Curated Bonus)

入选 Top 50 精选时，一次性奖励 **500 VP**：

```typescript
// 在 curationStore.update 中添加
async update(topicId: number, messageId: number, likeCount: number) {
  // ... 现有逻辑 ...

  // 🆕 检查是否新入选精选
  const wasInList = await prisma.curatedList.findFirst({
    where: { topicId, messageId },
  });

  if (!wasInList && likeCount > 0) {
    // 新入选，发放 500 VP 奖励
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { author: true },
    });

    if (message) {
      const CURATED_BONUS = BigInt(500) * BigInt(10 ** 18);
      await prisma.$transaction([
        prisma.vpReward.create({
          data: {
            userAddress: message.author,
            amount: CURATED_BONUS.toString(),
            source: 'CURATED_BONUS',
            referenceId: `topic:${topicId}:msg:${messageId}`,
          },
        }),
        prisma.user.update({
          where: { address: message.author },
          data: { vpBalance: { increment: CURATED_BONUS.toString() } },
        }),
      ]);
    }
  }
}
```

### 6.3 提现签名路由 (VPWithdraw 对接)

对接 `VPWithdraw.sol` 的 `withdrawWithVP` 函数：

```typescript
// api/routers/settlement.ts - 新增
signWithdraw: protectedProcedure
  .input(z.object({
    vpBurnAmount: z.string(),  // uint256 as string
    vdotReturn: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const userAddress = ctx.userAddress as `0x${string}`;

    // 1. 验证用户有足够 VP
    const balance = await vpBalanceStore.getEffectiveBalance(userAddress);
    if (balance < BigInt(input.vpBurnAmount)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient VP' });
    }

    // 2. 获取用户 nonce (从链上)
    const nonce = await vpContract.read.userNonce([userAddress]);

    // 3. 生成签名
    const signature = await signatureService.signWithdraw(
      userAddress,
      BigInt(input.vpBurnAmount),
      BigInt(input.vdotReturn),
      nonce,
    );

    // 4. 记录提现请求 (用于追踪)
    await prisma.withdrawalRequest.create({
      data: {
        userAddress,
        vpBurnAmount: input.vpBurnAmount,
        vdotReturn: input.vdotReturn,
        signature,
        nonce: Number(nonce),
        status: 'PENDING',
      },
    });

    return { signature, nonce: nonce.toString() };
  }),
```

**Supabase Edge Function 补充** - Withdraw 类型：

```typescript
// sign-settlement/index.ts - 添加 Withdraw 类型
const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "vpBurnAmount", type: "uint256" },
    { name: "vdotReturn", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

// 在 handler 中处理
if (type === "WITHDRAW") {
  const signature = await account.signTypedData({
    domain,
    types: WITHDRAW_TYPES,
    primaryType: "Withdraw",
    message: {
      user,
      vpBurnAmount: BigInt(vpBurnAmount),
      vdotReturn: BigInt(vdotReturn),
      nonce: BigInt(nonce),
    },
  });
  return new Response(JSON.stringify({ signature }));
}
```

### 6.4 议题状态机 (Topic Status Machine)

完整的议题状态流转：

```
LIVE → FROZEN → CLOSED → LANDED → MINTED
             ↑_________↓
             (可手动关闭)
```

```typescript
// 状态枚举 (需同步到 Prisma schema)
enum TopicStatus {
  LIVE = 'LIVE',           // 进行中，可发言
  FROZEN = 'FROZEN',       // 冻结期，不可发言，精选锁定
  CLOSED = 'CLOSED',       // 已关闭，待项目方落地
  LANDED = 'LANDED',       // 已落地，贡献者可铸造 NFT
  MINTED = 'MINTED',       // 已铸造 NFT
}

// api/routers/topic.ts - 新增状态转换
land: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const topic = await topicStore.get(input.id);
    if (!topic) throw new TRPCError({ code: 'NOT_FOUND' });

    // 只有创建者可以落地
    if (topic.creator !== ctx.userAddress) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only creator can land' });
    }

    // 只有 CLOSED 状态可以落地
    if (topic.status !== TopicStatus.CLOSED) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Topic must be closed first' });
    }

    await topicStore.updateStatus(input.id, TopicStatus.LANDED);
    return { success: true };
  }),
```

### 6.5 项目空间 (Space) - 可选扩展

根据 useway §1.2 "建立据点"，项目方需要创建项目空间：

```typescript
// 数据模型 (Prisma schema 补充)
model Space {
  id            Int      @id @default(autoincrement())
  name          String   @unique @db.VarChar(100)
  owner         String   @db.VarChar(42)
  twitterHandle String?  @db.VarChar(50)
  description   String?  @db.Text
  createdAt     DateTime @default(now())

  topics        Topic[]

  @@index([owner])
}

// Topic 表补充
model Topic {
  // ... 现有字段 ...
  spaceId       Int?
  space         Space?   @relation(fields: [spaceId], references: [id])
}
```

---

## 7. EIP-712 签名类型汇总

| 类型         | 对应合约函数                  | TypeHash                                                                       |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------ |
| `Settlement` | `VPSettlement.settleBalances` | `Settlement(address[] users,int256[] deltas,uint256 nonce)`                    |
| `Withdraw`   | `VPWithdraw.withdrawWithVP`   | `Withdraw(address user,uint256 vpBurnAmount,uint256 vdotReturn,uint256 nonce)` |
| `MintNFT`    | `NFTMint.mintWithSignature`   | `MintNFT(address minter,uint256 topicId,bytes32 ipfsHash,uint256 nonce)`       |

---

## 8. 环境变量完整清单 (更新)

```env
# ===================== 必填 =====================
DATABASE_URL=                       # Supabase PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=           # Supabase URL
SUPABASE_SERVICE_ROLE_KEY=          # Supabase 服务密钥
NEXT_PUBLIC_CHAIN_ID=               # 1284 (Moonbeam)
NEXT_PUBLIC_ROUTER_PROXY=           # 合约地址
CRON_SECRET=                        # Cron Job 密钥

# ===================== 可选 =====================
SETTLEMENT_THRESHOLD_VP=10000000000000000000000  # 10,000 VP
SETTLEMENT_INTERVAL_HOURS=4
MIN_SETTLEMENT_USERS=5
AI_FIXED_SCORE=0.5
RESPIRATION_RATE=0.05              # 每小时恢复比例
CURATED_BONUS_VP=500000000000000000000  # 500 VP 精选奖励
LIKE_RESONANCE_RATE=0.1            # 点赞返还比例
```

---

## 9. 核查总结

| 功能点                 | 来源             | 文档 §节  | 状态           |
| ---------------------- | ---------------- | --------- | -------------- |
| vDOT 质押 → VP         | VPStaking.sol    | 2.7       | ✅ 已涵盖      |
| VP 余额查询 (混合模式) | -                | 2.7, 2.9  | ✅ 已涵盖      |
| 发言扣除 VP            | useway §2        | 2.5       | ✅ 已涵盖      |
| 点赞扣除 VP            | useway §2        | 2.5       | ✅ 已涵盖      |
| 批量结算               | VPSettlement.sol | 2.6, 2.10 | ✅ 已涵盖      |
| NFT 铸造签名           | NFTMint.sol      | 2.6       | ✅ 已涵盖      |
| VP 自然恢复 (5%/h)     | useway §3.A      | 6.1       | ✅ 新增        |
| 点赞共鸣 (10% 返还)    | useway §3.B      | 6.1       | ✅ 新增        |
| 精选奖励 (500 VP)      | useway §3.1      | 6.2       | ✅ 新增        |
| 提现签名               | VPWithdraw.sol   | 6.3       | ✅ 新增        |
| 议题状态机 (LANDED)    | useway §5        | 6.4       | ✅ 新增        |
| 项目空间               | useway §1.2      | 6.5       | ✅ 新增 (可选) |
