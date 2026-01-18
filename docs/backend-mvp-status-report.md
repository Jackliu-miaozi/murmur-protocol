# Backend MVP Completion Report

## Completion Status
- Overall implementation: ~90% (code complete, pending deployment/config)
- Schema changes: implemented, not yet applied to DB (pending `prisma db push`)
- Core routes and stores: implemented
- Signature service: implemented with Supabase Edge Function fallback
- Cron settlement: implemented

---

## Completed Work (Key Items)
- Schema alignment in `app/viliage-gate/prisma/schema.prisma` (Space, LANDED, OpenGov fields, VP costs, reward idempotency, OpenGovReport)
- Chain read module in `app/viliage-gate/src/server/murmur/chain.ts`
- Auth middleware + `protectedProcedure` in `app/viliage-gate/src/server/api/trpc.ts`
- VP balance/respiration, rewards, and like store logic in `app/viliage-gate/src/server/murmur/store.ts`
- Topic/message/settlement routes updated for auth + VP logic
- New routers: `vp`, `space`, `opengov`, `admin`, `withdraw`
- Settlement batching with `limit/dryRun` and admin trigger
- OpenGov report persistence + retrieval
- Supabase Edge Function for signatures at `app/viliage-gate/src/supabase/functions/sign-settlement/index.ts`
- Vercel cron config in `vercel.json`
- Env template updated in `app/viliage-gate/.env.example`

---

## Manual Steps Required (Blocking)
1. Apply schema to database
   - Run: `npx prisma db push` (from `app/viliage-gate`)
2. Configure env vars in deployment
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_CHAIN_ID=420420422`
   - `VP_TOKEN_ADDRESS=0xB42a517d04a47ca019240E77479bf922812496D2`
   - `MURMUR_NFT_ADDRESS=0x752F6889481C055BcCF11c57ACb4efe3467Baf35`
   - `VDOT_TOKEN_ADDRESS=0x8C072D3f6bAda32fc25D4450aE1b190F2785fCEb`
   - `CRON_SECRET`, `SETTLEMENT_THRESHOLD_VP`, `MIN_SETTLEMENT_USERS`
   - `RESPIRATION_RATE`, `CURATED_BONUS_VP`, `LIKE_RESONANCE_RATE`, `ADMIN_WALLETS`
3. Deploy Supabase Edge Function
   - Set `OPERATOR_PRIVATE_KEY` in Supabase
   - Deploy `sign-settlement`
4. Ensure RPC + chain availability
   - `RPC_URL=https://testnet-passet-hub-eth-rpc.polkadot.io`
   - `CHAIN_ID=420420422`

---

## Next Steps (After Manual Setup)
1. Run integration tests for:
   - VP balance sync, message costs, rewards, and settlement signature verification
2. Validate OpenGov report generation and status flow
3. Confirm cron settlement works end-to-end

---

## Notes
- Signature service uses Supabase Edge Function when env is present; otherwise falls back to Mock.
- Until `db push` is run, new tables/fields (Space/OpenGovReport/LANDED) will not exist in DB.
