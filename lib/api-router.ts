import * as online from '@/lib/api';
import * as offline from '@/lib/api-offline';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  CreateExerciseInput,
  UpdateExerciseInput,
  AddSetInput,
} from '@/lib/types';

export const OFFLINE_COOKIE = 'bicek_offline';

export function isOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_OFFLINE_MODE !== 'true') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${OFFLINE_COOKIE}=true`));
}

export function enableOfflineMode() {
  document.cookie = `${OFFLINE_COOKIE}=true; path=/; max-age=86400`;
}

export function disableOfflineMode() {
  document.cookie = `${OFFLINE_COOKIE}=; path=/; max-age=0`;
}

function route<T>(fn: () => T): T {
  return fn();
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export const getPlans = () =>
  route(() => (isOfflineMode() ? offline.getPlans() : online.getPlans()));

export const createPlan = (input: CreatePlanInput) =>
  route(() => (isOfflineMode() ? offline.createPlan(input) : online.createPlan(input)));

export const updatePlan = (id: string, input: UpdatePlanInput) =>
  route(() => (isOfflineMode() ? offline.updatePlan(id, input) : online.updatePlan(id, input)));

export const deletePlan = (id: string) =>
  route(() => (isOfflineMode() ? offline.deletePlan(id) : online.deletePlan(id)));

// ─── Exercises ───────────────────────────────────────────────────────────────

export const getExercises = (planId: string) =>
  route(() => (isOfflineMode() ? offline.getExercises(planId) : online.getExercises(planId)));

export const createExercise = (input: CreateExerciseInput) =>
  route(() => (isOfflineMode() ? offline.createExercise(input) : online.createExercise(input)));

export const updateExercise = (id: string, input: UpdateExerciseInput) =>
  route(() =>
    isOfflineMode() ? offline.updateExercise(id, input) : online.updateExercise(id, input)
  );

export const deleteExercise = (id: string) =>
  route(() => (isOfflineMode() ? offline.deleteExercise(id) : online.deleteExercise(id)));

// ─── Workouts ────────────────────────────────────────────────────────────────

export const startWorkout = (planId: string) =>
  route(() => (isOfflineMode() ? offline.startWorkout(planId) : online.startWorkout(planId)));

export const getAnyActiveWorkout = () =>
  route(() => (isOfflineMode() ? offline.getAnyActiveWorkout() : online.getAnyActiveWorkout()));

export const getActiveWorkout = (planId: string) =>
  route(() =>
    isOfflineMode() ? offline.getActiveWorkout(planId) : online.getActiveWorkout(planId)
  );

export const getWorkout = (workoutId: string) =>
  route(() => (isOfflineMode() ? offline.getWorkout(workoutId) : online.getWorkout(workoutId)));

export const finishWorkout = (workoutId: string) =>
  route(() =>
    isOfflineMode() ? offline.finishWorkout(workoutId) : online.finishWorkout(workoutId)
  );

export const deleteWorkout = (workoutId: string) =>
  route(() =>
    isOfflineMode() ? offline.deleteWorkout(workoutId) : online.deleteWorkout(workoutId)
  );

export const getWorkoutHistory = () =>
  route(() => (isOfflineMode() ? offline.getWorkoutHistory() : online.getWorkoutHistory()));

// ─── Sets ────────────────────────────────────────────────────────────────────

export const getSets = (workoutId: string) =>
  route(() => (isOfflineMode() ? offline.getSets(workoutId) : online.getSets(workoutId)));

export const getSetsForWorkouts = (workoutIds: string[]) =>
  route(() =>
    isOfflineMode() ? offline.getSetsForWorkouts(workoutIds) : online.getSetsForWorkouts(workoutIds)
  );

export const addSet = (input: AddSetInput) =>
  route(() => (isOfflineMode() ? offline.addSet(input) : online.addSet(input)));

export const deleteSet = (id: string) =>
  route(() => (isOfflineMode() ? offline.deleteSet(id) : online.deleteSet(id)));

export const triggerXpBackfillBatch = () =>
  route(() =>
    isOfflineMode() ? Promise.resolve({ processed: 0 }) : online.triggerXpBackfillBatch()
  );

// ─── Exercise history ─────────────────────────────────────────────────────────

export const getExerciseHistory = (exerciseId: string, excludeWorkoutId: string) =>
  route(() =>
    isOfflineMode()
      ? offline.getExerciseHistory(exerciseId, excludeWorkoutId)
      : online.getExerciseHistory(exerciseId, excludeWorkoutId)
  );

// ─── RPG items / inventory / hunts ──────────────────────────────────────────

export const getRpgItems = () =>
  route(() => (isOfflineMode() ? offline.getRpgItems() : online.getRpgItems()));

export const getRpgInventory = () =>
  route(() => online.getRpgInventory());

export const equipRpgItem = (input: { item_id: string }) =>
  route(() => online.equipRpgItem(input));

export const unequipRpgItem = (itemId: string) =>
  route(() => online.unequipRpgItem(itemId));

export const getActiveHunt = () =>
  route(() => online.getActiveHunt());

export const startHunt = (rarity: string) =>
  route(() => online.startHunt(rarity));

export const collectHunt = () =>
  route(() => online.collectHunt());

export const tradeRpgInventoryRow = (inventoryRowId: string) =>
  route(() => online.tradeRpgInventoryRow(inventoryRowId));

// ─── Re-export shared utils from api.ts ──────────────────────────────────────

export { formatSetText, generateWorkoutSummary } from '@/lib/api';
export type { ExerciseHistoryEntry } from '@/lib/api';
