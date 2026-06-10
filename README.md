# SundayQuiz

Live, social game platform for classrooms and church gatherings — first module:
**bli-kjent-bingo** (peer-verified human bingo). Part of the Sunday Suite.
Live at **https://quiz.sundaysuite.app**.

- Spec: `docs/SPEC.md` (source of truth for product behaviour)
- Stack: Next.js (App Router) + Supabase (shared project, dedicated `quiz`
  schema) + Cloudflare Worker via OpenNext
- Identity: 6-digit PIN + display name + resume codes (no accounts)
- All writes go through API routes with the service role; the mark/verify/win
  logic is atomic plpgsql (`supabase/migrations/0002_mark_rpcs.sql`)

## Develop

```bash
npm install
npm run dev          # needs .env.local (see .env.example)
npm run check        # tsc + eslint + vitest
BASE=http://localhost:3000 node scripts/smoke.mjs
```

## Provision (one-time, shared Supabase project)

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/provision-shared.mjs
# applies migrations into the `quiz` schema + exposes it to PostgREST,
# then writes .env.local. Revoke the token afterwards.
```

## Deploy

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy           # → quiz.sundaysuite.app
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # first deploy only
```
