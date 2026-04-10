ALTER TABLE public.rpg_profiles
  ADD COLUMN IF NOT EXISTS max_inventory_size integer NOT NULL DEFAULT 20;
