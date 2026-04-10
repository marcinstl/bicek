export type ExerciseKind = 'weighted_reps' | 'bodyweight_reps' | 'time_based' | 'distance_per_time';

export interface Profile {
  id: string;
  created_at: string;
}

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  plan_id: string;
  name: string;
  kind: ExerciseKind;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  plan_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  xp_rates?: XpRates | null;
}

export interface WorkoutWithPlan extends Workout {
  plans: Pick<Plan, 'name'>;
}

export interface Set {
  id: string;
  workout_id: string;
  exercise_id: string;
  value: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  xp: number | null;
  note: string | null;
  created_at: string;
}

export interface SetWithExercise extends Set {
  exercises: Pick<Exercise, 'name' | 'kind'>;
}

// Form types
export interface CreatePlanInput {
  name: string;
}

export interface UpdatePlanInput {
  name: string;
}

export interface CreateExerciseInput {
  plan_id: string;
  name: string;
  kind: ExerciseKind;
}

export interface UpdateExerciseInput {
  name: string;
  kind: ExerciseKind;
}

export interface AddSetInput {
  workout_id: string;
  exercise_id: string;
  value?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  xp?: number | null;
  note?: string | null;
}

export interface RpgItem {
  id: string;
  code: string;
  name: string;
  type: string;
  eq_slot: string;
  icon_path: string;
  created_at: string;
}

export type RpgRequirement =
  | { type: 'total_level'; level: number; secret?: boolean }
  | { type: 'kind_level'; kind: ExerciseKind; level: number; secret?: boolean }
  | { type: 'total_xp'; xp: number; secret?: boolean }
  | { type: 'workout_count'; count: number; secret?: boolean }
  | { type: 'secret' };

export interface SpritePosition {
  col: number;
  row: number;
}

export interface RpgItemBuff {
  type: 'xp_rate';
  kind?: ExerciseKind | 'total';
  value: number;
}

export interface XpRates {
  weighted_reps: number;
  bodyweight_reps: number;
  time_based: number;
  distance_per_time: number;
  total: number;
}

export const DEFAULT_XP_RATES: XpRates = {
  weighted_reps: 100,
  bodyweight_reps: 100,
  time_based: 100,
  distance_per_time: 100,
  total: 100,
};

export type RpgRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** RPG-only profile row (hunt points, fragments). */
export interface RpgProfile {
  user_id: string;
  hunt_points: number;
  hunt_points_maximum: number;
  /** Max unequipped (bag) stacks; equipped items do not count. */
  max_inventory_size: number;
  fragments_common: number;
  fragments_uncommon: number;
  fragments_rare: number;
  fragments_epic: number;
  fragments_legendary: number;
  created_at?: string;
  updated_at?: string;
}

export interface RpgDiscoveredItem {
  id: string;
  eq_slot: string;
  spritesheet_path: string;
  rarity?: RpgRarity;
  name?: string | null;
  item_type?: string | null;
  requirements?: RpgRequirement[];
  sprite_positions?: SpritePosition[] | null;
  buffs?: RpgItemBuff[];
}

export interface RpgHunt {
  id: string;
  user_id: string;
  rarity: RpgRarity;
  duration_hours: number;
  started_at: string;
  collected_at: string | null;
  /** Set after first successful collect roll; cleared only if collect insert fails and is reverted. */
  loot_rolled_at?: string | null;
  created_at: string;
}

export interface RpgInventoryRow {
  id: string;
  user_id: string;
  item_id: string;
  equipped: boolean;
  equipped_at: string;
  updated_at: string;
  /** Hidden from client until hunt delivery completes or bag space frees up. */
  locked: boolean;
  pending_hunt_id: string | null;
}

export interface RpgInventoryWithItem extends RpgInventoryRow {
  item: RpgDiscoveredItem & { rarity: RpgRarity };
}
