-- Store hunt length as integer minutes (avoids fractional hours in DB).
ALTER TABLE public.rpg_hunts
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

UPDATE public.rpg_hunts
SET duration_minutes = round(duration_hours::numeric * 60)::integer
WHERE duration_minutes IS NULL;

ALTER TABLE public.rpg_hunts
  ALTER COLUMN duration_minutes SET NOT NULL;

ALTER TABLE public.rpg_hunts
  DROP COLUMN IF EXISTS duration_hours;
