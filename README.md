# Bicek – Workout Tracker

Personal workout tracking app with RPG progression system. Built with Next.js, Supabase, and TanStack Query.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **State**: TanStack Query v5 (all server state, optimistic updates)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel (frontend) + Supabase Cloud (database)

---

## Local Development

### Prerequisites

```bash
brew install supabase/tap/supabase
npm install
```

### 1. Start local Supabase

```bash
supabase start
```

This spins up a local Postgres + Auth + Storage stack via Docker.

### 2. Apply migrations

```bash
supabase db push --local
```

### 3. Start the dev server

```bash
npm run dev
```

### Local URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://localhost:54323 |
| Supabase API | http://localhost:54321 |
| Inbucket (email) | http://localhost:54324 |

### Environment

`.env.local` is already configured for local Supabase with the standard dev keys (safe to commit — they're Supabase's public demo keys):

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   # local anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...       # local service role key
```

To switch to production credentials, comment out the local block and uncomment the prod block at the bottom of `.env.local`.

---

## Database Migrations

All migrations live in `supabase/migrations/`. They run in filename order (timestamp prefix).

### Local

```bash
# Apply all pending migrations
supabase db push --local

# Roll back a specific migration (marks it as reverted, then re-push re-runs it)
supabase migration repair --status reverted <timestamp> --local
supabase db push --local

# Full reset — wipe local DB and re-apply all migrations from scratch
supabase db reset

# Run arbitrary SQL against local DB
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT ..."
```

### Production

```bash
# Push all pending migrations to prod (uses supabase link)
npm run deploy:database
# equivalent: supabase db push
```

> Requires `supabase link --project-ref <ref>` to have been run once.  
> Production project ref: `qprmdpbmojmcnjrxbama`

### Adding a new migration

```bash
supabase migration new <descriptive_name>
# creates supabase/migrations/<timestamp>_<descriptive_name>.sql
```

Write SQL in the generated file, then push locally to test, then push to prod.

---

## Deployment

### Frontend (Vercel)

```bash
npm run deploy:client
# equivalent: npx vercel --prod
```

Make sure the following env vars are set in the Vercel project dashboard:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Database (Supabase Cloud)

```bash
npm run deploy:database
# equivalent: supabase db push
```

### Typical release flow

```bash
# 1. Push DB changes first
npm run deploy:database

# 2. Then deploy the frontend
npm run deploy:client
```

---

## Admin Tool (local only)

The RPG item editor lives at **http://localhost:3000/admin/rpg** — only accessible when `NODE_ENV=development`.

Use it to create/edit RPG items and generate SQL `INSERT … ON CONFLICT DO UPDATE` statements that can be pasted into the Supabase SQL Editor on production.

---

## Project Structure

```
├── app/
│   ├── (auth)/          # Login / signup pages
│   ├── (app)/           # Authenticated app
│   │   ├── plans/       # Training plans
│   │   ├── history/     # Workout history
│   │   └── rpg/         # RPG progression + inventory
│   ├── admin/rpg/       # Local-only item editor
│   └── api/             # Next.js API routes (server-side Supabase calls)
├── hooks/               # TanStack Query hooks
├── lib/
│   ├── rpg/             # XP formulas, leveling, hunt logic, buffs
│   ├── supabase.ts      # Browser client
│   ├── supabase-server.ts  # Server client + admin client
│   └── types.ts         # Shared TypeScript types
├── public/pixelart/     # Sprite sheets (eq_sprites_t.png, etc.)
└── supabase/migrations/ # SQL migration files
```

---

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Per-user data: XP, level, hunt points |
| `plans` | Training plans |
| `exercises` | Exercises within a plan |
| `workouts` | Workout sessions (started_at, ended_at, xp_rates) |
| `sets` | Individual sets with XP |
| `rpg_items` | Item catalog (name, type, slot, buffs, sprite, rarity) |
| `rpg_item_requirements` | Requirements to discover each item |
| `rpg_inventory` | Items owned by a user (equipped flag) |
| `rpg_hunts` | Active and past hunts |

RLS is enabled on all tables — users can only access their own data.
