# AGENTS Guide for Murmur Protocol

This document is for agentic coding tools working in this repository.
It summarizes commands, conventions, and code style expectations.

## Repository layout
- Root contains `app/`, `contracts/`, `docs/`, and `node/`.
- The Next.js app lives in `app/viliage-gate`.
- Backend logic is under `app/viliage-gate/src/server`.
- Prisma schema is `app/viliage-gate/prisma/schema.prisma`.
- Supabase Edge Functions live in `app/viliage-gate/src/supabase/functions`.
- Frontend uses Next.js App Router under `app/viliage-gate/src/app`.

## Commands (run inside app/viliage-gate)
- Install deps: `pnpm install`
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Start prod build: `pnpm start`
- Preview (build + start): `pnpm preview`
- Lint: `pnpm lint`
- Lint fix: `pnpm lint:fix`
- Typecheck: `pnpm typecheck`
- Combined check: `pnpm check`
- Format check: `pnpm format:check`
- Format write: `pnpm format:write`

## Tests
- No test runner is configured in `package.json`.
- There is no single-test command yet.
- If tests are added later, document the single-test invocation here.

## Prisma and DB
- Schema: `app/viliage-gate/prisma/schema.prisma`.
- Apply schema locally: `npx prisma db push` (from `app/viliage-gate`).
- Generate client if needed: `npx prisma generate`.
- Prisma does not run in Edge runtime; use Node.js runtime for API routes.

## Supabase Edge Functions
- Function entry: `app/viliage-gate/src/supabase/functions/sign-settlement/index.ts`.
- Deploy from that directory using Supabase CLI.
- Requires `OPERATOR_PRIVATE_KEY` in Supabase env.

## Frontend conventions
- Use App Router pages under `src/app/**/page.tsx`.
- Use `"use client"` only when hooks/state are needed.
- Prefer server components for layout and data-independent UI.
- Shared UI: `AppShell`, `WalletConnectButton`, `WalletPanel`.
- VP formatting helper: `src/app/_components/utils/vp.ts`.
- Wagmi setup: `src/app/_components/wagmi-provider.tsx` and `wagmi-chain.ts`.
- Wallet auth headers are injected in `src/trpc/react.tsx` via `useWalletAuth()`.
- Protected tRPC calls require wallet signature headers.
- Keep UI text ASCII; avoid special symbols when editing.

## Backend conventions
- Routers live in `src/server/api/routers`.
- Use `protectedProcedure` for any write or state-changing actions.
- Validate inputs with Zod and return `TRPCError` on failure.
- Use `topicStore`, `vpStore`, `vpBalanceStore`, `vpRewardStore` for DB logic.
- Keep chain reads in `src/server/murmur/chain.ts`.
- Signature logic is in `src/server/murmur/signature.ts`.
- Use `settlementStore.getOrCreate` for settlement records.

## Data types and units
- VP values are stored as 1e18 integers (BigInt in code).
- Always convert to string for Prisma Decimal fields.
- Use `formatVp` for display; do not format manually.
- `vpCost` in messages is stored as Decimal(78,0).

## Naming conventions
- React components: PascalCase (e.g., `TopicArena`).
- Hooks: `useXxx`.
- Files: kebab-case for components (`topic-arena.tsx`).
- tRPC routers: camelCase in exports (`topicRouter`).
- DB stores: camelCase (`vpBalanceStore`).
- Enums: UPPER_SNAKE or PascalCase (Prisma enums are PascalCase).

## Imports and formatting
- Use absolute imports with `@/` alias where possible.
- Group imports: external, then internal.
- Do not reorder imports for styling unless necessary.
- Prettier is configured; run `pnpm format:write` for formatting.
- Tailwind classes are used for styling; keep class names on one line when possible.

## Error handling
- Use `TRPCError` for API layer errors.
- Wrap Prisma unique constraint errors (code `P2002`) where needed.
- Provide user-friendly error messages for UI actions.
- For wallet actions, validate connection state before calling mutations.

## Environment variables
- Client-side: `NEXT_PUBLIC_*`.
- Server-side: use non-public env vars for secrets.
- Required addresses:
  - `VP_TOKEN_ADDRESS` (VP Proxy)
  - `MURMUR_NFT_ADDRESS` (NFT Proxy)
  - `VDOT_TOKEN_ADDRESS`
- Chain config:
  - `RPC_URL`
  - `CHAIN_ID` and `NEXT_PUBLIC_CHAIN_ID`
- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Build/runtime notes
- Prisma requires Node.js runtime in API routes.
- Cron settlement route uses `runtime = "nodejs"`.
- Edge runtime should not import Prisma.

## Cursor/Copilot rules
- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions found in `.github/copilot-instructions.md`.

## When unsure
- Prefer updating store layer before router changes.
- Avoid editing contract ABIs unless the Solidity side changes.
- Ask before adding new dependencies or scripts.
