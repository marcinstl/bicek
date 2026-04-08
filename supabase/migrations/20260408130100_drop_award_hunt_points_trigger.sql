-- Hunt points are awarded in the app (POST /api/workouts/finish) via service role.
-- Remove DB trigger so points are not applied twice.

DROP TRIGGER IF EXISTS award_hunt_points_trigger ON public.workouts;
DROP FUNCTION IF EXISTS public.award_hunt_points();
