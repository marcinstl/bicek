-- Remove the redundant `slot` column from rpg_equipment.
-- The slot is derived from rpg_items.eq_slot.
-- A BEFORE INSERT trigger enforces that only one item per (user, slot) can be equipped.

-- 1. Drop old unique constraint and column.
alter table public.rpg_equipment
  drop constraint if exists rpg_equipment_user_slot_unique;

alter table public.rpg_equipment
  drop column if exists slot;

-- 2. New unique constraint: a user cannot equip the same item twice.
alter table public.rpg_equipment
  add constraint rpg_equipment_user_item_unique unique (user_id, item_id);

-- 3. Trigger that removes the previously equipped item in the same slot
--    before a new one is inserted, enforcing one-item-per-slot atomically.
create or replace function public.rpg_equipment_enforce_one_per_slot()
returns trigger language plpgsql as $$
begin
  delete from public.rpg_equipment
  where user_id = NEW.user_id
    and item_id != NEW.item_id
    and item_id in (
      select id from public.rpg_items
      where eq_slot = (
        select eq_slot from public.rpg_items where id = NEW.item_id
      )
    );
  return NEW;
end;
$$;

drop trigger if exists rpg_equipment_one_per_slot on public.rpg_equipment;
create trigger rpg_equipment_one_per_slot
  before insert on public.rpg_equipment
  for each row execute function public.rpg_equipment_enforce_one_per_slot();
