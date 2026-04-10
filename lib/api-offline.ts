import { getDb, OFFLINE_USER_ID, randomId } from '@/lib/offline-db';
import { computeSetXp } from '@/lib/rpg/xp';
import { sortSetsOldestFirst } from '@/lib/sort-sets';
import { MOCK_RPG_ITEMS } from '@/lib/rpg/pixelart-icons';
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
  RpgDiscoveredItem,
} from '@/lib/types';

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const db = await getDb();
  const all = await db.getAll('plans');
  return all
    .filter((p) => p.user_id === OFFLINE_USER_ID)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const db = await getDb();
  const plan: Plan = {
    id: randomId(),
    user_id: OFFLINE_USER_ID,
    name: input.name,
    created_at: new Date().toISOString(),
  };
  await db.put('plans', plan);
  return plan;
}

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<Plan> {
  const db = await getDb();
  const existing = await db.get('plans', id);
  if (!existing) throw new Error('Plan not found');
  const updated = { ...existing, name: input.name };
  await db.put('plans', updated);
  return updated;
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDb();
  // cascade: delete exercises, then workouts (sets cascade from workouts)
  const exercises = await db.getAllFromIndex('exercises', 'by_plan', id);
  for (const ex of exercises) await db.delete('exercises', ex.id);

  const workouts = await db.getAllFromIndex('workouts', 'by_plan', id);
  for (const w of workouts) {
    const sets = await db.getAllFromIndex('sets', 'by_workout', w.id);
    for (const s of sets) await db.delete('sets', s.id);
    await db.delete('workouts', w.id);
  }

  await db.delete('plans', id);
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function getExercises(planId: string): Promise<Exercise[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('exercises', 'by_plan', planId);
  return all
    .map((exercise) => ({
      ...exercise,
      kind: exercise.kind ?? 'bodyweight_reps',
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const db = await getDb();
  const exercise: Exercise = {
    id: randomId(),
    plan_id: input.plan_id,
    name: input.name,
    kind: input.kind,
    created_at: new Date().toISOString(),
  };
  await db.put('exercises', exercise);
  return exercise;
}

export async function updateExercise(id: string, input: UpdateExerciseInput): Promise<Exercise> {
  const db = await getDb();
  const existing = await db.get('exercises', id);
  if (!existing) throw new Error('Exercise not found');
  const updated: Exercise = {
    ...existing,
    name: input.name,
    kind: input.kind,
  };
  await db.put('exercises', updated);
  return updated;
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('exercises', id);
}

// ─── Workouts ────────────────────────────────────────────────────────────────

export async function startWorkout(planId: string): Promise<Workout> {
  const db = await getDb();
  const workout: Workout = {
    id: randomId(),
    user_id: OFFLINE_USER_ID,
    plan_id: planId,
    started_at: new Date().toISOString(),
    ended_at: null,
    created_at: new Date().toISOString(),
  };
  await db.put('workouts', workout);
  return workout;
}

export async function getAnyActiveWorkout(): Promise<Workout | null> {
  const db = await getDb();
  const all = await db.getAll('workouts');
  const active = all
    .filter((w) => w.ended_at === null)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  return active[0] ?? null;
}

export async function getActiveWorkout(planId: string): Promise<Workout | null> {
  const db = await getDb();
  const all = await db.getAllFromIndex('workouts', 'by_plan', planId);
  const active = all
    .filter((w) => w.ended_at === null)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  return active[0] ?? null;
}

export async function getWorkout(workoutId: string): Promise<Workout> {
  const db = await getDb();
  const w = await db.get('workouts', workoutId);
  if (!w) throw new Error('Workout not found');
  return w;
}

export async function finishWorkout(workoutId: string): Promise<Workout> {
  const db = await getDb();
  const existing = await db.get('workouts', workoutId);
  if (!existing) throw new Error('Workout not found');
  const updated = { ...existing, ended_at: new Date().toISOString() };
  await db.put('workouts', updated);
  return updated;
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const db = await getDb();
  const sets = await db.getAllFromIndex('sets', 'by_workout', workoutId);
  for (const s of sets) await db.delete('sets', s.id);
  await db.delete('workouts', workoutId);
}

export async function getWorkoutHistory(): Promise<WorkoutWithPlan[]> {
  const db = await getDb();
  const all = await db.getAll('workouts');
  const finished = all.filter((w) => w.ended_at !== null);
  finished.sort((a, b) => b.started_at.localeCompare(a.started_at));

  const result: WorkoutWithPlan[] = [];
  for (const w of finished) {
    const plan = await db.get('plans', w.plan_id);
    result.push({ ...w, plans: { name: plan?.name ?? 'Unknown' } });
  }
  return result;
}

// ─── RPG items / equipment (offline fallback) ───────────────────────────────

export async function getRpgItems(): Promise<RpgDiscoveredItem[]> {
  const db = await getDb();
  const rows = await db.getAll('rpg_items');
  if (rows.length === 0) {
    const tx = db.transaction('rpg_items', 'readwrite');
    for (const item of MOCK_RPG_ITEMS) {
      await tx.store.put(item);
    }
    await tx.done;
    return [...MOCK_RPG_ITEMS];
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

// RPG inventory and hunt operations are online-only (server-side security required).

// ─── Sets ────────────────────────────────────────────────────────────────────

export async function getSets(workoutId: string): Promise<SetWithExercise[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('sets', 'by_workout', workoutId);
  all.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const result: SetWithExercise[] = [];
  for (const s of all) {
    const exercise = await db.get('exercises', s.exercise_id);
    result.push({
      ...s,
      exercises: {
        name: exercise?.name ?? 'Unknown',
        kind: exercise?.kind ?? 'bodyweight_reps',
      },
    });
  }
  return result;
}

export async function getSetsForWorkouts(workoutIds: string[]): Promise<SetWithExercise[]> {
  if (workoutIds.length === 0) return [];
  const db = await getDb();
  const wanted = new Set(workoutIds);
  const allSets = await db.getAll('sets');
  const filtered = allSets.filter((s) => wanted.has(s.workout_id));
  filtered.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const exerciseCache = new Map<string, Exercise | undefined>();
  const result: SetWithExercise[] = [];
  for (const s of filtered) {
    if (!exerciseCache.has(s.exercise_id)) {
      exerciseCache.set(s.exercise_id, await db.get('exercises', s.exercise_id));
    }
    const exercise = exerciseCache.get(s.exercise_id);
    result.push({
      ...s,
      exercises: {
        name: exercise?.name ?? 'Unknown',
        kind: exercise?.kind ?? 'bodyweight_reps',
      },
    });
  }
  return result;
}

export async function addSet(input: AddSetInput): Promise<Set> {
  const db = await getDb();
  const exercise = await db.get('exercises', input.exercise_id);
  const kind = exercise?.kind ?? 'bodyweight_reps';
  const xp = input.xp ?? computeSetXp(kind, {
    value: input.value ?? null,
    reps: input.reps ?? null,
    duration_seconds: input.duration_seconds ?? null,
    distance_km: input.distance_km ?? null,
  });

  const set: Set = {
    id: randomId(),
    workout_id: input.workout_id,
    exercise_id: input.exercise_id,
    value: input.value ?? null,
    reps: input.reps ?? null,
    duration_seconds: input.duration_seconds ?? null,
    distance_km: input.distance_km ?? null,
    xp,
    note: input.note ?? null,
    created_at: new Date().toISOString(),
  };
  await db.put('sets', set);
  return set;
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sets', id);
}

export interface ExerciseHistoryEntry {
  workout: import('@/lib/types').Workout;
  sets: import('@/lib/types').Set[];
}

export async function getExerciseHistory(
  exerciseId: string,
  excludeWorkoutId: string
): Promise<ExerciseHistoryEntry[]> {
  const db = await getDb();
  const allSets = await db.getAll('sets');
  const exerciseSets = allSets.filter(
    (s) => s.exercise_id === exerciseId && s.workout_id !== excludeWorkoutId
  );

  const map = new Map<string, ExerciseHistoryEntry>();
  for (const s of exerciseSets) {
    if (!map.has(s.workout_id)) {
      const w = await db.get('workouts', s.workout_id);
      if (!w || w.ended_at === null) continue;
      map.set(s.workout_id, { workout: w, sets: [] });
    }
    map.get(s.workout_id)!.sets.push(s);
  }

  const entries = Array.from(map.values()).sort(
    (a, b) => b.workout.started_at.localeCompare(a.workout.started_at)
  );
  for (const e of entries) {
    e.sets = sortSetsOldestFirst(e.sets);
  }
  return entries;
}
