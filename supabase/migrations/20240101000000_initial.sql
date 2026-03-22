-- ─── profiles ───────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, created_at)
  values (new.id, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── plans ───────────────────────────────────────────────────────────────────
create table if not exists plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table plans enable row level security;

create policy "Users can manage own plans"
  on plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── exercises ───────────────────────────────────────────────────────────────
create table if not exists exercises (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  name        text not null,
  unit        text,
  metric_type text check (metric_type in ('reps', 'time')),
  created_at  timestamptz not null default now(),
  constraint at_least_one_config check (unit is not null or metric_type is not null)
);

alter table exercises enable row level security;

create policy "Users can manage exercises in own plans"
  on exercises for all
  using (
    exists (
      select 1 from plans p
      where p.id = exercises.plan_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plans p
      where p.id = exercises.plan_id
        and p.user_id = auth.uid()
    )
  );

-- ─── workouts ────────────────────────────────────────────────────────────────
create table if not exists workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  plan_id    uuid not null references plans(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

alter table workouts enable row level security;

create policy "Users can manage own workouts"
  on workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── sets ────────────────────────────────────────────────────────────────────
create table if not exists sets (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references workouts(id) on delete cascade,
  exercise_id      uuid not null references exercises(id) on delete cascade,
  value            numeric,
  reps             integer,
  duration_seconds integer,
  note             text,
  created_at       timestamptz not null default now()
);

alter table sets enable row level security;

create policy "Users can manage sets in own workouts"
  on sets for all
  using (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );
