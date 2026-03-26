import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Plan, Exercise, Workout, Set } from '@/lib/types';
import { computeSetXp } from '@/lib/rpg/xp';

interface BicekDB extends DBSchema {
  plans: {
    key: string;
    value: Plan;
    indexes: { by_user: string };
  };
  exercises: {
    key: string;
    value: Exercise;
    indexes: { by_plan: string };
  };
  workouts: {
    key: string;
    value: Workout;
    indexes: { by_user: string; by_plan: string };
  };
  sets: {
    key: string;
    value: Set;
    indexes: { by_workout: string };
  };
}

let dbPromise: Promise<IDBPDatabase<BicekDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BicekDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BicekDB>('bicek-offline', 3, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
        const plans = db.createObjectStore('plans', { keyPath: 'id' });
        plans.createIndex('by_user', 'user_id');

        const exercises = db.createObjectStore('exercises', { keyPath: 'id' });
        exercises.createIndex('by_plan', 'plan_id');

        const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
        workouts.createIndex('by_user', 'user_id');
        workouts.createIndex('by_plan', 'plan_id');

        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('by_workout', 'workout_id');
        }

        if (oldVersion < 2) {
          const setsStore = tx.objectStore('sets');
          let cursor = await setsStore.openCursor();
          while (cursor) {
            const value = cursor.value as Set & { xp?: number | null };
            if (value.xp === undefined) {
              cursor.update({ ...value, xp: null });
            }
            cursor = await cursor.continue();
          }
        }

        if (oldVersion < 3) {
          const setsStore = tx.objectStore('sets');
          const exercisesStore = tx.objectStore('exercises');
          let cursor = await setsStore.openCursor();
          while (cursor) {
            const value = cursor.value as Set;
            if (value.xp == null) {
              const exercise = (await exercisesStore.get(value.exercise_id)) as Exercise | undefined;
              const kind = exercise?.kind ?? 'bodyweight_reps';
              const xp = computeSetXp(kind, {
                value: value.value,
                reps: value.reps,
                duration_seconds: value.duration_seconds,
                distance_km: value.distance_km,
              });
              cursor.update({ ...value, xp });
            }
            cursor = await cursor.continue();
          }
        }
      },
    });
  }
  return dbPromise;
}

export const OFFLINE_USER_ID = 'offline-user';

export function randomId(): string {
  return crypto.randomUUID();
}
