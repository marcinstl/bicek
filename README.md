# FitnessAddict – Workout Tracker

Production-ready workout tracking MVP built with Next.js 16, Supabase, and TanStack Query.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **State**: TanStack Query v5 (all server state, optimistic updates)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)

## Project Structure

```
├── app/
│   ├── (auth)/login/        # Login page
│   ├── (auth)/signup/       # Signup page
│   ├── (app)/
│   │   ├── layout.tsx       # Nav + auth guard
│   │   ├── plans/           # Plans list + detail
│   │   │   └── [planId]/
│   │   │       ├── page.tsx         # Exercises list + start workout
│   │   │       └── workout/
│   │   │           ├── page.tsx     # Active workout
│   │   │           └── summary/     # Workout summary
│   │   └── history/         # Completed workouts
│   └── api/auth/callback/   # Supabase auth callback
├── lib/
│   ├── api.ts               # All Supabase API functions
│   ├── supabase.ts          # Browser Supabase client
│   ├── supabase-server.ts   # Server Supabase client
│   ├── types.ts             # TypeScript types
│   └── utils.ts             # cn() helper
├── hooks/
│   ├── useAuth.ts           # Auth state
│   ├── usePlans.ts          # Plans queries + mutations
│   ├── useExercises.ts      # Exercises queries + mutations
│   └── useWorkout.ts        # Workout queries + mutations
├── components/
│   ├── providers/QueryProvider.tsx
│   └── ui/                  # Button, Input, Modal, etc.
├── proxy.ts                 # Auth middleware (Next.js 16)
└── supabase/migrations/     # SQL migrations
```

## Supabase Setup

### 1. Create project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 3. Link & push migrations

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or manually run the migration SQL in the Supabase SQL Editor:

```
supabase/migrations/20240101000000_initial.sql
```

### 4. Configure environment

Copy `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local .env.local.example  # already exists
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in: Supabase Dashboard → Settings → API

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

| Table      | Key columns                                                        |
|------------|--------------------------------------------------------------------|
| profiles   | id (→ auth.users), created_at                                      |
| plans      | id, user_id, name, created_at                                      |
| exercises  | id, plan_id, name, unit?, metric_type? (reps\|time), created_at    |
| workouts   | id, user_id, plan_id, started_at, ended_at?, created_at            |
| sets       | id, workout_id, exercise_id, value?, reps?, duration_seconds?, note? |

RLS is enabled on all tables. Users can only access their own data.

## Workout Summary Format

```
Date: YYYY-MM-DD
Start: HH:MM
End: HH:MM
Duration: XX min

Exercise Name:
* 100kg x 10
* 100kg x 8 - felt heavy

Cardio:
* 60s
```

## Deploy

```bash
vercel --prod
```

Set the same env vars in your Vercel project settings.
