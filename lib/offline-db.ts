import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Plan, Exercise, Workout, Set } from '@/lib/types';

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
    dbPromise = openDB<BicekDB>('bicek-offline', 1, {
      upgrade(db) {
        const plans = db.createObjectStore('plans', { keyPath: 'id' });
        plans.createIndex('by_user', 'user_id');

        const exercises = db.createObjectStore('exercises', { keyPath: 'id' });
        exercises.createIndex('by_plan', 'plan_id');

        const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
        workouts.createIndex('by_user', 'user_id');
        workouts.createIndex('by_plan', 'plan_id');

        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('by_workout', 'workout_id');
      },
    });
  }
  return dbPromise;
}

export const OFFLINE_USER_ID = 'offline-user';

export function randomId(): string {
  return crypto.randomUUID();
}
