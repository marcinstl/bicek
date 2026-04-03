-- Add buffs JSONB column to rpg_items
alter table public.rpg_items
  add column if not exists buffs jsonb not null default '[]'::jsonb;

-- Add xp_rates JSONB column to workouts
-- Default: all rates at 100 (= no bonus, effective multiplier 1×)
alter table public.workouts
  add column if not exists xp_rates jsonb not null default
    '{"weighted_reps":100,"bodyweight_reps":100,"time_based":100,"distance_per_time":100,"total":100}'::jsonb;
