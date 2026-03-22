export type MetricType = 'reps' | 'time' | 'time_sec' | 'time_min';

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
  unit: string | null;
  metric_type: MetricType | null;
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
  note: string | null;
  created_at: string;
}

export interface SetWithExercise extends Set {
  exercises: Pick<Exercise, 'name' | 'unit' | 'metric_type'>;
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
  unit?: string | null;
  metric_type?: MetricType | null;
}

export interface UpdateExerciseInput {
  name: string;
  unit?: string | null;
  metric_type?: MetricType | null;
}

export interface AddSetInput {
  workout_id: string;
  exercise_id: string;
  value?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  note?: string | null;
}
