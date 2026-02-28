import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { User, Catalog, Exercise, DailyLog, ExportData } from './types';
import { StorageAdapter } from './storage';
import { todayISO } from './utils';

interface FitnessDB extends DBSchema {
  users: {
    key: string;
    value: User;
  };
  catalogs: {
    key: string;
    value: Catalog;
    indexes: { 'by-userId': string };
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
    dbPromise = openDB<FitnessDB>('fitness-addict', 2, {
      upgrade(db, oldVersion, newVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('users', { keyPath: 'id' });
          const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' });
          exerciseStore.createIndex('by-userId', 'userId');
          const logStore = db.createObjectStore('dailyLogs', { keyPath: 'id' });
          logStore.createIndex('by-exerciseId', 'exerciseId');
          logStore.createIndex('by-date', 'date');
        }
        if (oldVersion < 2) {
          const catalogStore = db.createObjectStore('catalogs', { keyPath: 'id' });
          catalogStore.createIndex('by-userId', 'userId');
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

  async getCatalogs(userId: string): Promise<Catalog[]> {
    const db = await getDB();
    return db.getAllFromIndex('catalogs', 'by-userId', userId);
  }

  async getCatalog(id: string): Promise<Catalog | null> {
    if (!id || typeof id !== 'string' || id.trim() === '') return null;
    const db = await getDB();
    return (await db.get('catalogs', id)) ?? null;
  }

  async createCatalog(catalog: Catalog): Promise<void> {
    const db = await getDB();
    await db.put('catalogs', catalog);
  }

  async updateCatalog(id: string, data: Partial<Catalog>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('catalogs', id);
    if (existing) {
      await db.put('catalogs', { ...existing, ...data });
    }
  }

  async deleteCatalog(id: string): Promise<void> {
    const db = await getDB();
    const catalog = await db.get('catalogs', id);
    if (catalog) {
      const exercises = (await db.getAllFromIndex('exercises', 'by-userId', catalog.userId))
        .filter((e: Exercise) => e.catalogId === id);
      for (const ex of exercises) {
        await db.put('exercises', { ...ex, catalogId: null });
      }
      await db.delete('catalogs', id);
    }
  }

  async getExercises(userId: string): Promise<Exercise[]> {
    const db = await getDB();
    return db.getAllFromIndex('exercises', 'by-userId', userId);
  }

  async getExercisesByCatalog(catalogId: string): Promise<Exercise[]> {
    const catalog = await this.getCatalog(catalogId);
    if (!catalog) return [];
    const all = await this.getExercises(catalog.userId);
    return all.filter(e => e.catalogId === catalogId);
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
    const catalogs = await this.getCatalogs(userId);
    const exercises = await this.getExercises(userId);
    const allLogs: DailyLog[] = [];

    for (const ex of exercises) {
      const logs = await db.getAllFromIndex('dailyLogs', 'by-exerciseId', ex.id);
      allLogs.push(...logs);
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: user!,
      catalogs,
      exercises,
      dailyLogs: allLogs,
    };
  }

  async importAll(data: ExportData): Promise<void> {
    const db = await getDB();
    const storeNames = ['users', 'catalogs', 'exercises', 'dailyLogs'] as const;
    const tx = db.transaction(storeNames, 'readwrite');

    const userStore = tx.objectStore('users');
    const allUsers = await userStore.getAll();
    for (const u of allUsers) await userStore.delete(u.id);
    await userStore.put(data.user);

    const catStore = tx.objectStore('catalogs');
    const allCats = await catStore.getAll();
    for (const c of allCats) await catStore.delete(c.id);
    for (const c of data.catalogs ?? []) await catStore.put(c);

    const exStore = tx.objectStore('exercises');
    const allEx = await exStore.getAll();
    for (const e of allEx) await exStore.delete(e.id);
    for (const e of data.exercises) await exStore.put(e);

    const logStore = tx.objectStore('dailyLogs');
    const allLogs = await logStore.getAll();
    for (const l of allLogs) await logStore.delete(l.id);
    for (const l of data.dailyLogs) await logStore.put(l);

    await tx.done;
  }
}
