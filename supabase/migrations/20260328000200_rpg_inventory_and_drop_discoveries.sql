-- Rename rpg_equipment → rpg_inventory.
-- Add equipped boolean (existing rows were equipped, default true).
-- Remove unique (user_id, item_id) — users may own multiple copies of an item.
-- Update the one-per-slot trigger to only act on equipped=true inserts.
-- Migrate rpg_item_discoveries → rpg_inventory (equipped=false), then drop the table.

-- 1. Rename table
alter table public.rpg_equipment rename to rpg_inventory;

-- 2. Rename the updated_at trigger to match new table name (drop + recreate)
drop trigger if exists set_rpg_equipment_updated_at on public.rpg_inventory;
create trigger set_rpg_inventory_updated_at
  before update on public.rpg_inventory
  for each row execute function public.set_updated_at();

-- 3. Add equipped column (existing rows are the equipped items → true)
alter table public.rpg_inventory
  add column if not exists equipped boolean not null default true;

-- 4. Remove the old unique constraint (users can own duplicate items)
alter table public.rpg_inventory
  drop constraint if exists rpg_equipment_user_item_unique;

-- 5. Rename index
alter index if exists rpg_equipment_user_id_idx rename to rpg_inventory_user_id_idx;

-- 6. Replace RLS policy name
drop policy if exists "Users can manage own rpg_equipment" on public.rpg_inventory;
create policy "Users can manage own rpg_inventory"
  on public.rpg_inventory
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. Update the one-per-slot trigger: only enforce when equipped=true
create or replace function public.rpg_inventory_enforce_one_per_slot()
returns trigger language plpgsql as $$
begin
  -- Only enforce the single-equipped-item-per-slot rule when equipping
  if NEW.equipped then
    delete from public.rpg_inventory
    where user_id = NEW.user_id
      and equipped = true
      and id != NEW.id
      and item_id in (
        select id from public.rpg_items
        where eq_slot = (
          select eq_slot from public.rpg_items where id = NEW.item_id
        )
      );
  end if;
  return NEW;
end;
$$;

drop trigger if exists rpg_equipment_one_per_slot on public.rpg_inventory;
create trigger rpg_inventory_one_per_slot
  before insert or update on public.rpg_inventory
  for each row execute function public.rpg_inventory_enforce_one_per_slot();

-- 8. Migrate rpg_item_discoveries → rpg_inventory with equipped=false
--    Skip items already present in rpg_inventory to avoid duplicates.
insert into public.rpg_inventory (user_id, item_id, equipped, equipped_at, updated_at)
select
  d.user_id,
  d.item_id,
  false,
  d.discovered_at,
  d.discovered_at
from public.rpg_item_discoveries d
where not exists (
  select 1 from public.rpg_inventory i
  where i.user_id = d.user_id and i.item_id = d.item_id and i.equipped = false
);

-- 9. Drop rpg_item_discoveries
drop table if exists public.rpg_item_discoveries;
