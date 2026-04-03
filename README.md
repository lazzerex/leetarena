# LeetArena

<p align="center">

 <img width="328" height="335" alt="image-removebg-preview (2)" src="https://github.com/user-attachments/assets/f02ebcb5-a79c-41d7-b53e-0e8675cd6b6e" />

</p>

<p align="center">
  <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white"/>
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white"/>
  <img src="https://img.shields.io/badge/GraphQL-E10098?style=flat&logo=graphql&logoColor=white"/>
  <img src="https://img.shields.io/badge/LeetCode%20Sync-GraphQL-E10098?style=flat&logo=graphql&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/pnpm-9-F69220?style=flat&logo=pnpm&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=flat&logo=cloudflare&logoColor=white"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white"/>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/lazzerex/leetarena?style=flat&logo=github"/>
  <img src="https://img.shields.io/github/forks/lazzerex/leetarena?style=flat&logo=github"/>
  <img src="https://img.shields.io/github/contributors/lazzerex/leetarena?style=flat"/>
  <img src="https://img.shields.io/github/issues-pr-raw/lazzerex/leetarena?label=pull%20requests&style=flat&color=yellow"/>
  <img src="https://img.shields.io/github/issues/lazzerex/leetarena?label=issues&style=flat&color=red"/>
  <img src="https://img.shields.io/badge/Release-v0.1.0--beta.1-blue?style=flat"/>
  <img src="https://img.shields.io/badge/Status-Beta%20WIP-orange?style=flat"/>
  <img src="https://img.shields.io/badge/Real--time-Supabase%20Realtime-blue?style=flat&logo=supabase"/>
</p>

<p align="center">
  <strong>A trading card game where LeetCode problems become collectible battle cards.</strong>
</p>

LeetArena blends coding practice with card-game progression. You can solve problems, strengthen your collection, and battle other players.

## Release Status

- Current first public release: v0.1.0-beta.1
- Project state: not feature-complete yet
- Important: expect breaking changes in future updates while core systems are still evolving

## What Is LeetArena?

Core idea:
- LeetCode problems are represented as cards with stats and element types.
- Players open packs, build decks, and play battles.
- Solving problems can unlock and upgrade card progression.

Gameplay pillars:
- Problem cards + algorithm cards.
- Type-based matchup system for battle decisions.
- Curated core catalog for balance, with optional extended variety mode.
- Optional, user-consented LeetCode sync.

## Tech Stack

- Frontend: SvelteKit + TypeScript + Tailwind CSS
- API: Hono on Cloudflare Workers
- Database/Auth/Realtime: Supabase
- Shared domain types: pnpm workspace package

## Technical Highlights

- Manifest-governed catalog pipeline with versioned contract, premium exclusion checks, and promotion-blocking validation.
- Scheduled drift detection on Cloudflare Worker cron to revalidate catalog integrity over time.
- Provenance-aware card governance using `catalog_type`, `is_seeded_core`, and `catalog_version` to protect ranked and pack balance.
- Feature-flagged runtime controls for sync, extended catalog ingestion, pack variety mode, and ranked core-only enforcement.
- Type-safe API boundaries with shared TypeScript domain contracts and route-level input validation.
- Supabase security model with row-level security policies and explicit service-role write path for backend operations.
- Realtime-ready battle architecture with published tables for battle and queue synchronization.

## Architecture Snapshot

```text
SvelteKit Web (apps/web)
  -> Hono API on Cloudflare Workers (apps/api)
  -> Supabase Postgres + Auth + Realtime
  -> Shared game types (packages/types)

Catalog Governance:
  manifest generate -> manifest validate -> seed core catalog -> scheduled drift revalidate
```

## Monorepo Layout

- apps/web: SvelteKit frontend
- apps/api: Hono Worker API
- packages/types: shared game types/constants

## Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Supabase project

### Install

```bash
pnpm install
```

### Configure Database
- Configure the required tables, indexes, and policies in your Supabase project before running the app.

### Configure Environment

Web app:
- Copy apps/web/.env.example -> apps/web/.env
- Required variables:
  - PUBLIC_SUPABASE_URL
  - PUBLIC_SUPABASE_ANON_KEY
  - PUBLIC_API_URL
- Optional:
  - PUBLIC_ENABLE_EXTENDED_PACKS

API:
- Copy apps/api/.dev.vars.example -> apps/api/.dev.vars
- Required variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - FRONTEND_URL
- Feature flags:
  - LEETCODE_SYNC_ENABLED
  - LEETCODE_EXTENDED_SYNC_ENABLED
  - PACK_VARIETY_MODE_ENABLED
  - RANKED_CORE_ONLY

### Run Locally

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

## Catalog Workflow

Core catalog is manifest-driven:
- Source of truth: apps/api/catalog/core-manifest.v1.json
- Generate manifest: pnpm --filter @leetarena/api catalog:manifest:generate
- Validate manifest: pnpm --filter @leetarena/api catalog:manifest:validate
- Seed catalog: pnpm --filter @leetarena/api seed:core-catalog

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
- pnpm catalog:manifest:generate
- pnpm catalog:manifest:validate
- pnpm seed:core-catalog

## Assets Credits

UI and card-pack assets used in this project are credited to:
- Tornioduva Card Pack (itch.io): https://tornioduva.itch.io/tornioduva-card-pack
- Free Card Packs by Argametina (itch.io): https://argametina.itch.io/free-card-packs

Please follow each creator's license and usage terms on their itch.io pages.

## License

MIT (or project-specific license when added).
