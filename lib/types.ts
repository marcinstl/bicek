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

export interface RpgDiscoveredItem {
  id: string;
  eq_slot: string;
  spritesheet_path: string;
  name?: string;
  item_type?: string;
  requirements?: RpgRequirement[];
  sprite_positions?: SpritePosition[] | null;
}

export interface RpgItemDiscoveryRow {
  id: string;
  user_id: string;
  item_id: string;
  discovered_at: string;
}

export interface RpgEquipmentRow {
  id: string;
  user_id: string;
  item_id: string;
  equipped_at: string;
  updated_at: string;
}

export interface RpgEquipmentWithItem extends RpgEquipmentRow {
  item: RpgDiscoveredItem;
}
