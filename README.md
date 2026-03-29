# LeetArena
 
<p align="center">
  
 <img width="328" height="335" alt="image-removebg-preview (2)" src="https://github.com/user-attachments/assets/f02ebcb5-a79c-41d7-b53e-0e8675cd6b6e" />

</p>
 
<p align="center">
  <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white"/>
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=flat&logo=cloudflare&logoColor=white"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white"/>
</p>
 
<p align="center">
  <img src="https://img.shields.io/github/stars/lazzerex/leetarena?style=flat&logo=github"/>
  <img src="https://img.shields.io/github/forks/lazzerex/leetarena?style=flat&logo=github"/>
  <img src="https://img.shields.io/github/contributors/lazzerex/leetarena?style=flat"/>
  <img src="https://img.shields.io/github/issues-pr-raw/lazzerex/leetarena?label=pull%20requests&style=flat&color=yellow"/>
  <img src="https://img.shields.io/github/issues/lazzerex/leetarena?label=issues&style=flat&color=red"/>
  <img src="https://img.shields.io/badge/Status-Active%20MVP-orange?style=flat"/>
  <img src="https://img.shields.io/badge/Real--time-Supabase%20Realtime-blue?style=flat&logo=supabase"/>
</p>
 
<p align="center">
  <strong>A trading card game built on LeetCode problems. Collect cards, build decks, and battle other developers</strong>
</p>

## Current State

This repository is an active MVP with working foundations and known gaps.

Implemented now:
- Monorepo with SvelteKit web app, Hono API, shared TypeScript package.
- Supabase schema with core entities: users, cards, user_cards, algorithm_cards, decks, battles, packs, leetcode_sync, matchmaking_queue.
- API routes for sync, packs, battle, and cards.
- Web routes for login, packs, collection, deck builder, battle lobby, leaderboard, and profile.
- Pack opening flow with rarity rolling and pity counter scaffolding.
- OAuth auth via Supabase (GitHub/Google) for app identity.

Partially implemented / planned:
- Full server-authoritative battle state machine.
- Complete matchmaking orchestration.
- Quests and achievements persistence.
- Advanced algorithm/data-structure card gameplay.
- Optional LeetCode sync hardening.


## Product and Compliance Direction

- LeetArena is LeetCode-based, not a full LeetCode interface.
- Core progression must work without requiring LeetCode account sync.
- Any LeetCode sync is optional and compliance-sensitive.
- Do not rely on private/disallowed automation against LeetCode endpoints.

## Architecture

- apps/web: SvelteKit frontend (Vercel target)
- apps/api: Hono API on Cloudflare Workers
- packages/types: shared TypeScript models/constants
- supabase-schema.sql: DB bootstrap and policies

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Supabase account
- Cloudflare account (for API deploy)

### Install

```bash
pnpm install
```

### Database
Run supabase-schema.sql in Supabase SQL editor.

### Environment

Web:
- Copy apps/web/.env.example to apps/web/.env
- Set:
  - PUBLIC_SUPABASE_URL
  - PUBLIC_SUPABASE_ANON_KEY
  - PUBLIC_API_URL

API:
- Copy apps/api/.dev.vars.example to apps/api/.dev.vars
- Set:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - FRONTEND_URL
- Optional for future integrations:
  - UPSTASH_REDIS_REST_URL
  - UPSTASH_REDIS_REST_TOKEN
  - QSTASH_TOKEN
  - RESEND_API_KEY

### Run locally

From the repo root, open two terminals.

Terminal 1 (API):
```bash
pnpm --filter @leetarena/api dev
```

Terminal 2 (Web):
```bash
pnpm --filter @leetarena/web dev
```

Local URLs:
- Web: http://localhost:5173
- API health: http://localhost:8787/health

### Troubleshooting Local Start

- If VS Code still shows old module errors, run:
  1. `TypeScript: Restart TS Server`
  2. `Developer: Reload Window`
- If `pnpm` is not recognized in a terminal, open a new terminal session after installation.
- If port 5173 or 8787 is busy, stop previous dev servers before restarting.

## Scripts

Root:
- pnpm dev
- pnpm build
- pnpm lint
- pnpm typecheck

Web:
- pnpm dev
- pnpm build
- pnpm preview
- pnpm check
- pnpm lint

API:
- pnpm dev
- pnpm build
- pnpm deploy

## Deployment

API (Cloudflare Workers):
1. Configure worker secrets with wrangler secret put.
2. cd apps/api && pnpm deploy.

Web (Vercel):
1. Import repo with root directory apps/web.
2. Set public env vars.
3. Deploy.

## Roadmap (Implementation Plan Summary)

Phase 1: Foundation hardening
- API auth and ownership checks.
- Robust API error handling and typed responses.
- Correct battle reward/rating persistence.

Phase 2: Gameplay completion
- Full battle state machine and round progression.
- Matchmaking orchestration and realtime parity.
- Backend and frontend deck-rule parity.

Phase 3: Progression expansion
- Quests/achievements persistence.
- Algorithm/data-structure card systems.
- Reliable leaderboard metrics.

Phase 4: Optional LeetCode enhancements
- User-consented sync mode.
- Compliance-safe verification approach.

## Notes
- This README reflects the implementation plan and current repository state as of 2026-03-25.
