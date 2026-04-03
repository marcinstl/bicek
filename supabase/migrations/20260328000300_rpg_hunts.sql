-- Hunt system: users actively start timed hunts to earn items.

create table if not exists public.rpg_hunts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  rarity          public.rpg_rarity not null,
  duration_hours  int not null,
  started_at      timestamptz not null default now(),
  collected_at    timestamptz,
  reward_item_ids uuid[],
  created_at      timestamptz not null default now()
);

create index if not exists rpg_hunts_user_id_idx
  on public.rpg_hunts (user_id);

alter table public.rpg_hunts enable row level security;

-- Users can read their own hunts and insert new ones.
-- Updates (collect) are done via service role only.
create policy "Users can read own rpg_hunts"
  on public.rpg_hunts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own rpg_hunts"
  on public.rpg_hunts
  for insert
  with check (auth.uid() = user_id);
