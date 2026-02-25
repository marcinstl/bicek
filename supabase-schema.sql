-- Supabase schema for bicek (online mode)
-- Run this in the Supabase SQL Editor

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'online',
  "createdAt" timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  name text not null,
  "startValue" integer not null,
  "currentTarget" double precision not null,
  "dailyRate" double precision not null default 0.01,
  streak integer not null default 0,
  "totalReps" integer not null default 0,
  "currentDay" integer not null default 1,
  "daysPerWeek" integer not null default 7,
  "createdAt" timestamptz not null default now()
);

create table if not exists "dailyLogs" (
  id uuid primary key default gen_random_uuid(),
  "exerciseId" uuid not null references exercises(id) on delete cascade,
  "dayNumber" integer not null,
  target integer not null,
  completed integer not null default 0,
  date date not null default current_date,
  "isRestDay" boolean not null default false
);

create index if not exists idx_exercises_user on exercises("userId");
create index if not exists idx_logs_exercise on "dailyLogs"("exerciseId");
create index if not exists idx_logs_date on "dailyLogs"(date);

-- Row Level Security
alter table users enable row level security;
alter table exercises enable row level security;
alter table "dailyLogs" enable row level security;

create policy "Users can manage own data"
  on users for all using (auth.uid() = id);

create policy "Users can manage own exercises"
  on exercises for all using (auth.uid() = "userId");

create policy "Users can manage own logs"
  on "dailyLogs" for all using (
    "exerciseId" in (
      select id from exercises where "userId" = auth.uid()
    )
  );
