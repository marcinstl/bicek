import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Plan,
  Exercise,
  Workout,
  Set,
  RpgDiscoveredItem,
  RpgEquipmentRow,
  RpgItemDiscoveryRow,
} from '@/lib/types';
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
  rpg_items: {
    key: string;
    value: RpgDiscoveredItem;
    indexes: { by_eq_slot: string };
  };
  rpg_equipment: {
    key: string;
    value: RpgEquipmentRow;
    indexes: { by_user: string; by_slot: string };
  };
  rpg_item_discoveries: {
    key: string;
    value: RpgItemDiscoveryRow;
    indexes: { by_user: string; by_user_item: [string, string] };
  };
}

let dbPromise: Promise<IDBPDatabase<BicekDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BicekDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BicekDB>('bicek-offline', 5, {
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

        if (oldVersion < 4) {
          const rpgItems = db.createObjectStore('rpg_items', { keyPath: 'id' });
          rpgItems.createIndex('by_eq_slot', 'eq_slot');

          const rpgEquipment = db.createObjectStore('rpg_equipment', { keyPath: 'id' });
          rpgEquipment.createIndex('by_user', 'user_id');
          rpgEquipment.createIndex('by_slot', 'slot');
        }

        if (oldVersion < 5) {
          const rpgDiscoveries = db.createObjectStore('rpg_item_discoveries', { keyPath: 'id' });
          rpgDiscoveries.createIndex('by_user', 'user_id');
          rpgDiscoveries.createIndex('by_user_item', ['user_id', 'item_id'], { unique: true });
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

export async function mirrorRpgItems(items: RpgDiscoveredItem[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('rpg_items', 'readwrite');
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function mirrorRpgEquipment(rows: RpgEquipmentRow[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('rpg_equipment', 'readwrite');
  await tx.store.clear();
  for (const row of rows) {
    await tx.store.put(row);
  }
  await tx.done;
}

export async function mirrorUpsertRpgEquipment(row: RpgEquipmentRow): Promise<void> {
  const db = await getDb();
  await db.put('rpg_equipment', row);
}

export async function mirrorDeleteRpgEquipmentBySlot(userId: string, slot: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('rpg_equipment', 'readwrite');
  let cursor = await tx.store.index('by_slot').openCursor(slot);
  while (cursor) {
    if (cursor.value.user_id === userId) {
      await cursor.delete();
      break;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
