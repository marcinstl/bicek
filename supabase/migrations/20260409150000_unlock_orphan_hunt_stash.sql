-- Recover rows left locked + pending_hunt_id cleared after collect bug (ORDER BY non-existent created_at).
-- Those stacks were invisible in the UI and had no way to finish the hunt.
UPDATE public.rpg_inventory
SET locked = false
WHERE locked = true
  AND pending_hunt_id IS NULL;
