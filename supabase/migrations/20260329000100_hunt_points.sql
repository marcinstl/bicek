-- Add hunt points economy to profiles.
-- 1 minute of training = 1 hunt point. Default cap = 420 (= 7 hours).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hunt_points         float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hunt_points_maximum int   NOT NULL DEFAULT 420;

-- Ensure default and existing rows reflect the minutes-based cap (420 min = 7 h).
ALTER TABLE public.profiles
  ALTER COLUMN hunt_points_maximum SET DEFAULT 420;
UPDATE public.profiles SET hunt_points_maximum = 420 WHERE hunt_points_maximum = 7;

-- Award hunt points proportional to workout duration when a workout is finished.
CREATE OR REPLACE FUNCTION public.award_hunt_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  duration_minutes float;
BEGIN
  -- Only fire when ended_at transitions from NULL to a timestamp.
  IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60.0;
    UPDATE public.profiles
    SET hunt_points = LEAST(hunt_points + duration_minutes, hunt_points_maximum)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_hunt_points_trigger ON public.workouts;
CREATE TRIGGER award_hunt_points_trigger
  AFTER UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.award_hunt_points();
