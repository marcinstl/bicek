create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.rpg_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null,
  item_id uuid not null references public.rpg_items(id) on delete restrict,
  equipped_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rpg_equipment_user_slot_unique unique (user_id, slot)
);

create index if not exists rpg_equipment_user_id_idx
  on public.rpg_equipment (user_id);

alter table public.rpg_equipment enable row level security;

drop policy if exists "Users can manage own rpg_equipment" on public.rpg_equipment;
create policy "Users can manage own rpg_equipment"
  on public.rpg_equipment
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_rpg_equipment_updated_at on public.rpg_equipment;
create trigger set_rpg_equipment_updated_at
  before update on public.rpg_equipment
  for each row
  execute function public.set_updated_at();
