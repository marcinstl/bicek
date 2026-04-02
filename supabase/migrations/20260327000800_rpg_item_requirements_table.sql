-- New table to replace the JSONB requirements column on rpg_items.

create table if not exists public.rpg_item_requirements (
  id          uuid        primary key default gen_random_uuid(),
  item_id     uuid        not null references public.rpg_items(id) on delete cascade,
  type        text        not null check (type in ('total_level','kind_level','total_xp','workout_count')),
  level       integer,
  kind        text,
  xp          integer,
  count       integer,
  secret      boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Migrate existing JSONB data into rows.
insert into public.rpg_item_requirements (item_id, type, level, kind, xp, count, secret)
select
  ri.id,
  (req->>'type')::text,
  (req->>'level')::integer,
  (req->>'kind')::text,
  (req->>'xp')::integer,
  (req->>'count')::integer,
  coalesce((req->>'secret')::boolean, false)
from public.rpg_items ri,
     jsonb_array_elements(ri.requirements) as req
where jsonb_array_length(ri.requirements) > 0;

-- RLS: authenticated users can read (server strips secrets before sending to browser).
alter table public.rpg_item_requirements enable row level security;

create policy "Authenticated users can read rpg_item_requirements"
  on public.rpg_item_requirements
  for select
  to authenticated
  using (true);

-- Remove the JSONB column now that data lives in the new table.
alter table public.rpg_items drop column if exists requirements;
