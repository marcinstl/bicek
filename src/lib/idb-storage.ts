import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { User, Exercise, DailyLog, ExportData } from './types';
import { StorageAdapter } from './storage';
import { todayISO } from './utils';

interface FitnessDB extends DBSchema {
  users: {
    key: string;
    value: User;
  };
  exercises: {
    key: string;
    value: Exercise;
    indexes: { 'by-userId': string };
  };
  dailyLogs: {
    key: string;
    value: DailyLog;
    indexes: {
      'by-exerciseId': string;
      'by-date': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<FitnessDB>> | null = null;

function getDB(): Promise<IDBPDatabase<FitnessDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FitnessDB>('fitness-addict', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('users', { keyPath: 'id' });
          const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' });
          exerciseStore.createIndex('by-userId', 'userId');
          const logStore = db.createObjectStore('dailyLogs', { keyPath: 'id' });
          logStore.createIndex('by-exerciseId', 'exerciseId');
          logStore.createIndex('by-date', 'date');
        }
        const rawDb = db as unknown as { createObjectStore(n: string, o?: { keyPath: string }): { createIndex(a: string, b: string): void }; objectStoreNames: { contains(n: string): boolean }; deleteObjectStore(n: string): void };
        if (oldVersion < 2) {
          const catalogStore = rawDb.createObjectStore('catalogs', { keyPath: 'id' });
          catalogStore.createIndex('by-userId', 'userId');
        }
        if (oldVersion < 3 && rawDb.objectStoreNames.contains('catalogs')) {
          rawDb.deleteObjectStore('catalogs');
        }
      },
    });
  }
  return dbPromise;
}

export class IDBStorage implements StorageAdapter {
  async getUser(): Promise<User | null> {
    const db = await getDB();
    const all = await db.getAll('users');
    return all[0] ?? null;
  }

  async createUser(user: User): Promise<void> {
    const db = await getDB();
    await db.put('users', user);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('users', userId);
    if (existing) {
      await db.put('users', { ...existing, ...data });
    }
  }

  async getExercises(userId: string): Promise<Exercise[]> {
    const db = await getDB();
    return db.getAllFromIndex('exercises', 'by-userId', userId);
  }

  async getExercise(id: string): Promise<Exercise | null> {
    if (!id || typeof id !== 'string' || id.trim() === '') return null;
    const db = await getDB();
    return (await db.get('exercises', id)) ?? null;
  }

  async createExercise(exercise: Exercise): Promise<void> {
    const db = await getDB();
    await db.put('exercises', exercise);
  }

  async updateExercise(id: string, data: Partial<Exercise>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('exercises', id);
    if (existing) {
      await db.put('exercises', { ...existing, ...data });
    }
  }

  async deleteExercise(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('exercises', id);

    const logs = await db.getAllFromIndex('dailyLogs', 'by-exerciseId', id);
    const tx = db.transaction('dailyLogs', 'readwrite');
    for (const log of logs) {
      await tx.store.delete(log.id);
    }
    await tx.done;
  }

  async getDailyLogs(exerciseId: string): Promise<DailyLog[]> {
    const db = await getDB();
    return db.getAllFromIndex('dailyLogs', 'by-exerciseId', exerciseId);
  }

  async getRecentLogs(exerciseId: string, count: number): Promise<DailyLog[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('dailyLogs', 'by-exerciseId', exerciseId);
    return all.sort((a, b) => a.dayNumber - b.dayNumber).slice(-count);
  }

  async createDailyLog(log: DailyLog): Promise<void> {
    const db = await getDB();
    await db.put('dailyLogs', log);
  }

  async updateDailyLog(id: string, data: Partial<DailyLog>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('dailyLogs', id);
    if (existing) {
      await db.put('dailyLogs', { ...existing, ...data });
    }
  }

  async deleteDailyLog(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('dailyLogs', id);
  }

  async getTodayLog(exerciseId: string): Promise<DailyLog | null> {
    const db = await getDB();
    const today = todayISO();
    const logs = await db.getAllFromIndex('dailyLogs', 'by-exerciseId', exerciseId);
    return logs.find(l => l.date === today) ?? null;
  }

  async exportAll(userId: string): Promise<ExportData> {
    const db = await getDB();
    const user = await this.getUser();
    const exercises = await this.getExercises(userId);
    const allLogs: DailyLog[] = [];

    for (const ex of exercises) {
      const logs = await db.getAllFromIndex('dailyLogs', 'by-exerciseId', ex.id);
      allLogs.push(...logs);
    }

    const exercisesForExport = exercises.map((e) => {
      const copy = { ...e } as Record<string, unknown>;
      delete copy.catalogId;
      delete copy.currentDay; // obliczane przy imporcie z dailyLogs
      delete copy.xpMultiplier; // liczony z formuły, nie eksportować
      return copy as Exercise;
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: user!,
      exercises: exercisesForExport,
      dailyLogs: allLogs,
    };
  }

  async importAll(data: ExportData): Promise<void> {
    const db = await getDB();
    const storeNames = ['users', 'exercises', 'dailyLogs'] as const;
    const tx = db.transaction(storeNames, 'readwrite');

    const userStore = tx.objectStore('users');
    const allUsers = await userStore.getAll();
    for (const u of allUsers) await userStore.delete(u.id);
    await userStore.put(data.user);

    const exStore = tx.objectStore('exercises');
    const allEx = await exStore.getAll();
    for (const e of allEx) await exStore.delete(e.id);
    const exercisesToImport = data.exercises.map((e) => {
      const copy = { ...e } as Record<string, unknown>;
      delete copy.catalogId;
      delete copy.xpMultiplier; // nie persystować, multiplier z formuły
      const logsForEx = data.dailyLogs.filter((l) => l.exerciseId === e.id);
      const currentDay =
        logsForEx.length === 0 ? 1 : Math.max(...logsForEx.map((l) => l.dayNumber)) + 1;
      return { ...copy, currentDay } as Exercise;
    });
    for (const e of exercisesToImport) await exStore.put(e);

    const logStore = tx.objectStore('dailyLogs');
    const allLogs = await logStore.getAll();
    for (const l of allLogs) await logStore.delete(l.id);
    for (const l of data.dailyLogs) await logStore.put(l);

    await tx.done;
  }
}
