import { createClient } from '@/lib/supabase';
import {
  mirrorDeleteRpgEquipmentBySlot,
  mirrorRpgEquipment,
  mirrorRpgItems,
  mirrorUpsertRpgEquipment,
} from '@/lib/offline-db';
import { computeSetXp } from '@/lib/rpg/xp';
import type {
  Plan,
  Exercise,
  ExerciseKind,
  Workout,
  Set,
  SetWithExercise,
  WorkoutWithPlan,
  CreatePlanInput,
  UpdatePlanInput,
  CreateExerciseInput,
  UpdateExerciseInput,
  AddSetInput,
  RpgDiscoveredItem,
  RpgItemDiscoveryRow,
  RpgEquipmentRow,
  RpgEquipmentWithItem,
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
      kind: input.kind,
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
      kind: input.kind,
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

export async function getAnyActiveWorkout(): Promise<Workout | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
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

export async function deleteWorkout(workoutId: string): Promise<void> {
  const supabase = createClient();
  const { error: setsError } = await supabase.from('sets').delete().eq('workout_id', workoutId);
  if (setsError) throw setsError;
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
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

// ─── RPG items / equipment ───────────────────────────────────────────────────

export async function getRpgItems(): Promise<RpgDiscoveredItem[]> {
  const res = await fetch('/api/rpg/items');
  if (!res.ok) throw new Error('Failed to fetch RPG items');
  const items = (await res.json()) as RpgDiscoveredItem[];
  await mirrorRpgItems(items);
  return items;
}

export async function getRpgEquipment(): Promise<RpgEquipmentWithItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rpg_equipment')
    .select('*, item:rpg_items(id,eq_slot,icon_path)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as RpgEquipmentWithItem[];
  await mirrorRpgEquipment(rows.map((entry) => {
    const { item, ...row } = entry;
    void item;
    return row;
  }));
  return rows;
}

export async function equipRpgItem(input: { slot: string; item_id: string }): Promise<RpgEquipmentRow> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('rpg_equipment')
    .upsert(
      {
        user_id: userData.user.id,
        slot: input.slot,
        item_id: input.item_id,
        equipped_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slot' }
    )
    .select()
    .single();
  if (error) throw error;
  const row = data as RpgEquipmentRow;
  await mirrorUpsertRpgEquipment(row);
  return row;
}

export async function unequipRpgItem(slot: string): Promise<void> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('rpg_equipment')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('slot', slot);
  if (error) throw error;
  await mirrorDeleteRpgEquipmentBySlot(userData.user.id, slot);
}

export async function getDiscoveredItems(): Promise<RpgItemDiscoveryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rpg_item_discoveries')
    .select('*')
    .order('discovered_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RpgItemDiscoveryRow[];
}

export async function tryDiscoverItems(): Promise<string[]> {
  const res = await fetch('/api/rpg/discover', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[tryDiscoverItems] error', res.status, body);
    return [];
  }
  const json = (await res.json()) as { newly_discovered?: string[] };
  return json.newly_discovered ?? [];
}

// ─── Sets ────────────────────────────────────────────────────────────────────

export async function getSets(workoutId: string): Promise<SetWithExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sets')
    .select('*, exercises(name, kind)')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SetWithExercise[];
}

export async function getSetsForWorkouts(workoutIds: string[]): Promise<SetWithExercise[]> {
  if (workoutIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sets')
    .select('*, exercises(name, kind)')
    .in('workout_id', workoutIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SetWithExercise[];
}

export async function addSet(input: AddSetInput): Promise<Set> {
  const supabase = createClient();
  let xp: number | null = input.xp ?? null;

  if (xp == null) {
    const { data: exercise, error: exerciseError } = await supabase
      .from('exercises')
      .select('kind')
      .eq('id', input.exercise_id)
      .single();
    if (exerciseError) throw exerciseError;

    xp = computeSetXp(exercise.kind as ExerciseKind, {
      value: input.value ?? null,
      reps: input.reps ?? null,
      duration_seconds: input.duration_seconds ?? null,
      distance_km: input.distance_km ?? null,
    });
  }

  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_id: input.workout_id,
      exercise_id: input.exercise_id,
      value: input.value ?? null,
      reps: input.reps ?? null,
      duration_seconds: input.duration_seconds ?? null,
      distance_km: input.distance_km ?? null,
      xp,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function triggerXpBackfillBatch(): Promise<{ processed: number }> {
  const res = await fetch('/api/rpg/backfill', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run XP backfill');
  return (await res.json()) as { processed: number };
}

export async function deleteSet(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw error;
}

export interface ExerciseHistoryEntry {
  workout: Workout;
  sets: Set[];
}

export async function getExerciseHistory(
  exerciseId: string,
  excludeWorkoutId: string
): Promise<ExerciseHistoryEntry[]> {
  const supabase = createClient();
  let q = supabase
    .from('sets')
    .select('*, workouts!inner(id, started_at, ended_at, plan_id, user_id, created_at)')
    .eq('exercise_id', exerciseId)
    .not('workouts.ended_at', 'is', null)
    .order('created_at', { ascending: false });
  if (excludeWorkoutId) q = q.neq('workout_id', excludeWorkoutId);

  const { data, error } = await q;
  if (error) throw error;

  // Group by workout
  const map = new Map<string, ExerciseHistoryEntry>();
  for (const row of data ?? []) {
    const w = (row as typeof row & { workouts: Workout }).workouts;
    if (!map.has(w.id)) map.set(w.id, { workout: w, sets: [] });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workouts: _w, ...set } = row as typeof row & { workouts: Workout };
    map.get(w.id)!.sets.push(set as Set);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.workout.started_at.localeCompare(a.workout.started_at)
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function formatTime(duration_seconds: number): string {
  const hours = Math.floor(duration_seconds / 3600);
  const mins = Math.floor((duration_seconds % 3600) / 60);
  const secs = duration_seconds % 60;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}min`;
  return `${secs}s`;
}

export function formatSetText(
  s: Pick<Set, 'value' | 'reps' | 'duration_seconds' | 'distance_km' | 'note'>,
  exercise: Pick<Exercise, 'kind'>
): string {
  let line = '';
  if (exercise.kind === 'weighted_reps' && s.value != null && s.reps != null) {
    line = `${s.value}kg x ${s.reps}`;
  } else if (exercise.kind === 'bodyweight_reps' && s.reps != null) {
    line = `${s.reps} reps`;
  } else if (exercise.kind === 'time_based' && s.duration_seconds != null) {
    line = formatTime(s.duration_seconds);
  } else if (
    exercise.kind === 'distance_per_time' &&
    s.distance_km != null &&
    s.duration_seconds != null &&
    s.duration_seconds > 0
  ) {
    const speed = (s.distance_km / s.duration_seconds) * 3600;
    line = `${s.distance_km}km in ${formatTime(s.duration_seconds)} (${speed.toFixed(1)} km/h)`;
  } else if (exercise.kind === 'distance_per_time' && s.distance_km != null) {
    line = `${s.distance_km}km`;
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
  const setGapById = buildSetGapById(workout, sets);

  for (const exercise of exercises) {
    const exerciseSets = sets.filter((s) => s.exercise_id === exercise.id);
    if (exerciseSets.length === 0) continue;

    summary += `\n${exercise.name}:\n`;
    for (const s of exerciseSets) {
      const gapSec = setGapById.get(s.id);
      const gapText =
        gapSec != null ? ` (+${formatTime(gapSec)} since previous log)` : '';
      summary += `* ${formatSetText(s, exercise)}${gapText}\n`;
    }
    summary += `${formatExerciseTotal(exercise, exerciseSets)}\n`;
  }

  return summary.trim();
}

function buildSetGapById(
  workout: Pick<Workout, 'started_at'>,
  sets: Array<Pick<SetWithExercise, 'id' | 'created_at'>>
): Map<string, number> {
  const ordered = [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const gaps = new Map<string, number>();
  let previousMs = new Date(workout.started_at).getTime();

  for (const set of ordered) {
    const currentMs = new Date(set.created_at).getTime();
    const delta = Math.max(0, Math.round((currentMs - previousMs) / 1000));
    gaps.set(set.id, delta);
    previousMs = currentMs;
  }

  return gaps;
}

function formatExerciseTotal(exercise: Exercise, exerciseSets: SetWithExercise[]): string {
  if (exercise.kind === 'weighted_reps') {
    const totalVolumeKg = exerciseSets.reduce((sum, s) => {
      if (s.value == null || s.reps == null) return sum;
      return sum + s.value * s.reps;
    }, 0);
    return `Total volume: ${totalVolumeKg.toFixed(0)} kg`;
  }

  if (exercise.kind === 'distance_per_time') {
    const totalDistanceKm = exerciseSets.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
    const totalSeconds = exerciseSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    const avgSpeed = totalSeconds > 0 ? (totalDistanceKm / totalSeconds) * 3600 : 0;
    return `Total distance: ${totalDistanceKm.toFixed(2)} km, total time: ${formatTime(totalSeconds)}, avg speed: ${avgSpeed.toFixed(1)} km/h`;
  }

  if (exercise.kind === 'time_based') {
    const totalSeconds = exerciseSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    return `Total time: ${formatTime(totalSeconds)}`;
  }

  const totalReps = exerciseSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  return `Total reps: ${totalReps}`;
}
