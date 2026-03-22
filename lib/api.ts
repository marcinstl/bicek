import { createClient } from '@/lib/supabase';
import type {
  Plan,
  Exercise,
  Workout,
  Set,
  SetWithExercise,
  WorkoutWithPlan,
  CreatePlanInput,
  UpdatePlanInput,
  CreateExerciseInput,
  UpdateExerciseInput,
  AddSetInput,
} from '@/lib/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('plans')
    .insert({ name: input.name, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<Plan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plans')
    .update({ name: input.name })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlan(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) throw error;
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function getExercises(planId: string): Promise<Exercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      plan_id: input.plan_id,
      name: input.name,
      unit: input.unit ?? null,
      metric_type: input.metric_type ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExercise(id: string, input: UpdateExerciseInput): Promise<Exercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .update({
      name: input.name,
      unit: input.unit ?? null,
      metric_type: input.metric_type ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}

// ─── Workouts ────────────────────────────────────────────────────────────────

export async function startWorkout(planId: string): Promise<Workout> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('workouts')
    .insert({ plan_id: planId, user_id: user.id, started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveWorkout(planId: string): Promise<Workout | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('plan_id', planId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWorkout(workoutId: string): Promise<Workout> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single();
  if (error) throw error;
  return data;
}

export async function finishWorkout(workoutId: string): Promise<Workout> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workouts')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', workoutId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWorkoutHistory(): Promise<WorkoutWithPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workouts')
    .select('*, plans(name)')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkoutWithPlan[];
}

// ─── Sets ────────────────────────────────────────────────────────────────────

export async function getSets(workoutId: string): Promise<SetWithExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sets')
    .select('*, exercises(name, unit, metric_type)')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SetWithExercise[];
}

export async function addSet(input: AddSetInput): Promise<Set> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_id: input.workout_id,
      exercise_id: input.exercise_id,
      value: input.value ?? null,
      reps: input.reps ?? null,
      duration_seconds: input.duration_seconds ?? null,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSet(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw error;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function formatSetText(
  s: Pick<Set, 'value' | 'reps' | 'duration_seconds' | 'note'>,
  exercise: Pick<Exercise, 'unit' | 'metric_type'>
): string {
  let line = '';

  if (exercise.unit && s.value != null && exercise.metric_type === 'reps' && s.reps != null) {
    line = `${s.value}${exercise.unit} x ${s.reps}`;
  } else if (exercise.unit && s.value != null) {
    line = `${s.value}${exercise.unit}`;
  } else if (exercise.metric_type === 'reps' && s.reps != null) {
    line = `${s.reps} reps`;
  } else if (exercise.metric_type === 'time' && s.duration_seconds != null) {
    line = `${s.duration_seconds}s`;
  } else {
    line = 'set';
  }

  if (s.note) line += ` - ${s.note}`;
  return line;
}

export function generateWorkoutSummary(
  workout: Workout,
  exercises: Exercise[],
  sets: SetWithExercise[]
): string {
  const start = new Date(workout.started_at);
  const end = workout.ended_at ? new Date(workout.ended_at) : new Date();
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

  let summary = `Date: ${dateStr}\nStart: ${startStr}\nEnd: ${endStr}\nDuration: ${durationMin} min\n`;

  for (const exercise of exercises) {
    const exerciseSets = sets.filter((s) => s.exercise_id === exercise.id);
    if (exerciseSets.length === 0) continue;

    summary += `\n${exercise.name}:\n`;
    for (const s of exerciseSets) {
      summary += `* ${formatSetText(s, exercise)}\n`;
    }
  }

  return summary.trim();
}
