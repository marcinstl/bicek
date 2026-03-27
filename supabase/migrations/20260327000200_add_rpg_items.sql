create table if not exists public.rpg_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null,
  eq_slot text not null,
  icon_path text not null,
  created_at timestamptz not null default now()
);

alter table public.rpg_items enable row level security;

drop policy if exists "Authenticated users can read rpg_items" on public.rpg_items;
create policy "Authenticated users can read rpg_items"
  on public.rpg_items
  for select
  to authenticated
  using (true);

with item_files as (
  select format('Iicon_32_%s.png', lpad(gs::text, 2, '0')) as file_name
  from generate_series(1, 40) as gs
  union all
  select format('icon_32_2_%s.png', lpad(gs::text, 2, '0')) as file_name
  from generate_series(1, 30) as gs
)
insert into public.rpg_items (code, name, type, eq_slot, icon_path)
select
  file_name as code,
  file_name as name,
  'weapon-sword' as type,
  'slot-weapon' as eq_slot,
  'pixelart/' || file_name as icon_path
from item_files
on conflict (code) do update
set
  name = excluded.name,
  type = excluded.type,
  eq_slot = excluded.eq_slot,
  icon_path = excluded.icon_path;
