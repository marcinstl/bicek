create table if not exists public.rpg_item_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.rpg_items(id) on delete cascade,
  discovered_at timestamptz not null default now(),
  constraint rpg_item_discoveries_user_item_unique unique (user_id, item_id)
);

create index if not exists rpg_item_discoveries_user_id_idx
  on public.rpg_item_discoveries (user_id);

create index if not exists rpg_item_discoveries_user_item_idx
  on public.rpg_item_discoveries (user_id, item_id);

alter table public.rpg_item_discoveries enable row level security;

drop policy if exists "Users can manage own rpg_item_discoveries" on public.rpg_item_discoveries;
create policy "Users can manage own rpg_item_discoveries"
  on public.rpg_item_discoveries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read rpg_items" on public.rpg_items;
drop policy if exists "Users can read discovered rpg_items" on public.rpg_items;
create policy "Users can read discovered rpg_items"
  on public.rpg_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.rpg_item_discoveries d
      where d.item_id = rpg_items.id
        and d.user_id = auth.uid()
    )
  );

insert into public.rpg_item_discoveries (user_id, item_id, discovered_at)
select
  e.user_id,
  e.item_id,
  coalesce(e.equipped_at, now())
from public.rpg_equipment e
on conflict (user_id, item_id) do nothing;
