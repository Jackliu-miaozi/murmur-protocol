# Frontend Plan (Useway MVP)

This plan aligns the UI flow in `docs/useway_v3_unified.md` with the current backend routes.

---

## Routes / Pages (Next.js App Router)
- `/` Landing + quick entry
- `/spaces` Space list
- `/spaces/[spaceId]` Space detail + topic timeline
- `/topics/[topicId]` Live Arena (dual panel)
- `/topics/[topicId]/opengov` OpenGov report + status
- `/topics/[topicId]/mint` Mint entry after landing
- `/wallet` VP energy panel + history
- `/withdraw` Withdraw VP → vDOT
- `/admin` Admin dashboard

---

## Core Component Tree
- Global
  - `AppShell`
  - `TopNav`
  - `WalletConnectButton`
  - `VpMeter`
- Space
  - `SpaceList`, `SpaceCard`
  - `SpaceHeader`, `SpaceTopics`
- Topic / Live Arena
  - `TopicHeader` (status, countdown, Close/Land)
  - `LiveArenaLayout`
    - Left: `TimelineFeed`
    - Right: `DiscussionPanel`
  - `MessageComposer`, `MessageList`, `MessageItem`, `LikeButton`
  - `CuratedPanel` (Top 50)
- OpenGov
  - `ReportEditor`, `ReportPreview`, `StatusBadge`
- Mint
  - `MintEligibilityCard`, `MintActionButton`
- Admin
  - `SettlementStats`, `SettlementTrigger`, `CronStatus`

---

## Backend Route Mapping
- Space: `space.create`, `space.list`, `space.get`, `space.listTopics`
- Topic: `topic.list`, `topic.get`, `topic.create`, `topic.close`, `topic.land`
- Message: `message.listByTopic`, `message.post`, `message.like`, `message.getCurated`
- VP: `vp.getBalance`, `vp.syncBalance`
- OpenGov: `opengov.generateReport`, `opengov.getReport`, `opengov.markSubmitted`, `opengov.updateStatus`
- Mint: `settlement.signMintNFT`, `settlement.recordMintedNFT`
- Withdraw: `withdraw.signWithdraw`
- Admin: `admin.getStats`, `admin.triggerSettlement`

---

## Auth + Wallet Signature
- All `protectedProcedure` calls must send headers:
  - `x-wallet-address`
  - `x-wallet-message`
  - `x-wallet-signature`
- Suggest a `useWalletAuth()` hook that:
  - Signs a short-lived message (timestamped)
  - Caches for 5 minutes
  - Injects headers into tRPC link

---

## Useway Stage Alignment
- **Onboarding**: Connect wallet + VP energy meter
- **Space**: Create project base + timeline
- **Topic**: Create topic under space
- **Discussion**: Post/like with VP cost feedback
- **Consensus**: Curated panel shows Top 50
- **OpenGov**: Generate report and update status
- **Landing**: Close/Land actions
- **Mint**: Mint NFT after landing
- **Withdraw**: Burn VP for vDOT

---

## Implementation Priority
1. Wallet + VP panel + Space/Topic list
2. Live Arena (post/like/curated)
3. Close/Land + Mint flow
4. OpenGov report flow
5. Withdraw + Admin
