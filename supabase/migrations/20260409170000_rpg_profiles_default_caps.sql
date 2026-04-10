-- New defaults for future rows / trigger inserts. Does not UPDATE existing profiles.
ALTER TABLE public.rpg_profiles
  ALTER COLUMN hunt_points_maximum SET DEFAULT 75;

ALTER TABLE public.rpg_profiles
  ALTER COLUMN max_inventory_size SET DEFAULT 5;
