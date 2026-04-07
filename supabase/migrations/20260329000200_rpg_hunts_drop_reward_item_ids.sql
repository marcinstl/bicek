-- reward_item_ids is redundant: awarded items are already stored in rpg_inventory.
ALTER TABLE public.rpg_hunts DROP COLUMN IF EXISTS reward_item_ids;
