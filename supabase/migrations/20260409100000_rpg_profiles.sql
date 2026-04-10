-- RPG economy + fragments live here; core app profile stays in public.profiles.

CREATE TABLE IF NOT EXISTS public.rpg_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  hunt_points double precision NOT NULL DEFAULT 0,
  hunt_points_maximum integer NOT NULL DEFAULT 420,
  fragments_common integer NOT NULL DEFAULT 0,
  fragments_uncommon integer NOT NULL DEFAULT 0,
  fragments_rare integer NOT NULL DEFAULT 0,
  fragments_epic integer NOT NULL DEFAULT 0,
  fragments_legendary integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rpg_profiles_user_id_idx ON public.rpg_profiles (user_id);

INSERT INTO public.rpg_profiles (user_id, hunt_points, hunt_points_maximum)
SELECT id, hunt_points, hunt_points_maximum
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS hunt_points,
  DROP COLUMN IF EXISTS hunt_points_maximum;

ALTER TABLE public.rpg_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rpg profile"
  ON public.rpg_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_rpg_profiles_updated_at ON public.rpg_profiles;
CREATE TRIGGER set_rpg_profiles_updated_at
  BEFORE UPDATE ON public.rpg_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_rpg_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rpg_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_rpg ON public.profiles;
CREATE TRIGGER on_profile_created_rpg
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_rpg_profile_for_new_user();
