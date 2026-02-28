'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, Catalog, Exercise, DailyLog, ExportData, AuthMode, DebugInfo } from '@/lib/types';
import { StorageAdapter } from '@/lib/storage';
import { IDBStorage } from '@/lib/idb-storage';
import { SupabaseStorage } from '@/lib/supabase-storage';
import { getSupabase } from '@/lib/supabase';
import { processDay, shouldRestDay, advanceTarget, effectiveRate } from '@/lib/progression';
import { generateId, todayISO, dateToISO, getWeekStart, getWeekDates, getMonthStart } from '@/lib/utils';

interface AppState {
  user: User | null;
  catalogs: Catalog[];
  exercises: Exercise[];
  currentExercise: Exercise | null;
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  isRestDay: boolean;
  loading: boolean;
  debugMode: boolean;
  setsVersion: number;
}

interface AppContextType extends AppState {
  loginLocal: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  signupEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => void;
  addExercise: (name: string, startValue: number, daysPerWeek?: number, catalogId?: string | null, newCatalogName?: string) => Promise<void>;
  createCatalog: (name: string, daysPerWeek: number) => Promise<Catalog>;
  selectExercise: (id: string) => Promise<void>;
  setExerciseCatalog: (exerciseId: string, catalogId: string | null) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  markCatalogRestDay: (catalogId: string) => Promise<void>;
  undoCatalogRestDay: (catalogId: string) => Promise<void>;
  getEffectiveDaysPerWeek: (exercise: Exercise) => number;
  getCatalogForExercise: (exercise: Exercise) => Catalog | null;
  completeDay: (completed: number) => Promise<void>;
  addMoreReps: (additional: number) => Promise<void>;
  skipRestDay: () => Promise<void>;
  markTodayRest: () => Promise<void>;
  undoTodayRest: () => Promise<void>;
  resetToday: () => Promise<void>;
  editPastLog: (logId: string, completed: number) => Promise<void>;
  getRestBudget: () => { total: number; used: number; remaining: number };
  getExerciseTodayLog: (exerciseId: string) => Promise<DailyLog | null>;
  getRestBudgetForExercise: (exerciseId: string) => Promise<{ total: number; used: number; remaining: number }>;
  getWeeklyGroupPreview: (exerciseIds: string[]) => Promise<Array<{
    date: string;
    isRestDay: boolean;
    completed: number;
    total: number;
    hasLog: boolean;
  }>>;
  exportData: () => Promise<ExportData>;
  importData: (data: ExportData) => Promise<void>;
  getWeekTotal: () => number;
  getMonthTotal: () => number;
  getAllTimeTotal: () => number;
  getDebugInfo: () => DebugInfo | null;
  setDebugDailyRate: (rate: number) => Promise<void>;
  simulateNextDay: () => Promise<void>;
  setDebugMode: (on: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const storageRef = useRef<StorageAdapter | null>(null);
  const [state, setState] = useState<AppState>({
    user: null,
    catalogs: [],
    exercises: [],
    currentExercise: null,
    todayLog: null,
    allLogs: [],
    isRestDay: false,
    loading: true,
    debugMode: false,
    setsVersion: 0,
  });

  const getEffectiveDaysPerWeek = useCallback((exercise: Exercise): number => {
    if (!exercise.catalogId) return exercise.daysPerWeek ?? 7;
    const catalog = state.catalogs.find(c => c.id === exercise.catalogId);
    return catalog ? catalog.daysPerWeek : (exercise.daysPerWeek ?? 7);
  }, [state.catalogs]);

  const getCatalogForExercise = useCallback((exercise: Exercise): Catalog | null => {
    if (!exercise.catalogId) return null;
    return state.catalogs.find(c => c.id === exercise.catalogId) ?? null;
  }, [state.catalogs]);

  const refreshExercise = useCallback(async (exerciseId: string) => {
    if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim() === '') return;
    if (!storageRef.current) return;
    const storage = storageRef.current;

    await backfillMissedDays(storage, exerciseId);

    const ex = await storage.getExercise(exerciseId);
    if (!ex) return;

    const todayLog = await storage.getTodayLog(exerciseId);
    let isRest = todayLog?.isRestDay ?? false;
    if (!isRest && ex.catalogId) {
      isRest = await getCatalogRestToday(storage, ex.catalogId);
    }
    const allLogs = await storage.getDailyLogs(exerciseId);
    if (!isRest) {
      const recentLogs = await storage.getRecentLogs(exerciseId, 10);
      const catalog = ex.catalogId ? await storage.getCatalog(ex.catalogId) : null;
      const effectiveDpw = catalog ? catalog.daysPerWeek : (ex.daysPerWeek ?? 7);
      isRest = shouldRestDay(ex, recentLogs, effectiveDpw);
    }

    setState(s => ({
      ...s,
      currentExercise: ex,
      todayLog,
      allLogs,
      isRestDay: isRest,
    }));
  }, []);

  useEffect(() => {
    const init = async () => {
      const stored = typeof window !== 'undefined'
        ? localStorage.getItem('fitness-addict-mode')
        : null;

      if (stored === 'local') {
        const storage = new IDBStorage();
        storageRef.current = storage;
        const user = await storage.getUser();
        if (user) {
          const [catalogs, exercises] = await Promise.all([
            storage.getCatalogs(user.id),
            storage.getExercises(user.id),
          ]);
          setState(s => ({ ...s, user, catalogs, exercises, loading: false }));
          if (exercises.length > 0) {
            const last = localStorage.getItem('fitness-addict-current-exercise');
            const targetId = last && exercises.find(e => e.id === last) ? last : exercises[0].id;
            await refreshExerciseStatic(storage, targetId, setState);
          }
          return;
        }
      }

      if (stored === 'online') {
        const supabase = getSupabase();
        if (supabase) {
          const storage = new SupabaseStorage(supabase);
          storageRef.current = storage;
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            let user = await storage.getUser();
            if (!user) {
              user = {
                id: session.user.id,
                mode: 'online',
                createdAt: new Date().toISOString(),
              };
              await storage.createUser(user);
            }
            const [catalogs, exercises] = await Promise.all([
              storage.getCatalogs(user.id),
              storage.getExercises(user.id),
            ]);
            setState(s => ({ ...s, user, catalogs, exercises, loading: false }));
            if (exercises.length > 0) {
              await refreshExerciseStatic(storage, exercises[0].id, setState);
            }
            return;
          }
        }
      }

      setState(s => ({ ...s, loading: false }));
    };

    init();
  }, []);

  const loginLocal = useCallback(async () => {
    const storage = new IDBStorage();
    storageRef.current = storage;
    const user: User = {
      id: generateId(),
      mode: 'local',
      createdAt: new Date().toISOString(),
    };
    await storage.createUser(user);
    localStorage.setItem('fitness-addict-mode', 'local');
    setState(s => ({ ...s, user, catalogs: [], exercises: [], loading: false }));
  }, []);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const storage = new SupabaseStorage(supabase);
    storageRef.current = storage;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Auth failed');

    let user = await storage.getUser();
    if (!user) {
      user = { id: authUser.id, mode: 'online', createdAt: new Date().toISOString() };
      await storage.createUser(user);
    }

    localStorage.setItem('fitness-addict-mode', 'online');
    const [catalogs, exercises] = await Promise.all([
      storage.getCatalogs(user.id),
      storage.getExercises(user.id),
    ]);
    setState(s => ({ ...s, user, catalogs, exercises, loading: false }));

    if (exercises.length > 0) {
      await refreshExerciseStatic(storage, exercises[0].id, setState);
    }
  }, []);

  const signupEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const loginGoogle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
  }, []);

  const logout = useCallback(() => {
    const supabase = getSupabase();
    if (supabase) supabase.auth.signOut();
    localStorage.removeItem('fitness-addict-mode');
    localStorage.removeItem('fitness-addict-current-exercise');
    storageRef.current = null;
    setState({
      user: null,
      catalogs: [],
      exercises: [],
      currentExercise: null,
      todayLog: null,
      allLogs: [],
      isRestDay: false,
      loading: false,
      debugMode: false,
      setsVersion: 0,
    });
  }, []);

  const addExercise = useCallback(async (
    name: string,
    startValue: number,
    daysPerWeek: number = 7,
    catalogId?: string | null,
    newCatalogName?: string
  ) => {
    if (!storageRef.current || !state.user) return;
    let finalCatalogId: string | null = catalogId ?? null;
    if (newCatalogName?.trim()) {
      const catalog: Catalog = {
        id: generateId(),
        userId: state.user.id,
        name: newCatalogName.trim(),
        daysPerWeek,
        createdAt: new Date().toISOString(),
      };
      await storageRef.current.createCatalog(catalog);
      finalCatalogId = catalog.id;
      setState(s => ({ ...s, catalogs: [...s.catalogs, catalog] }));
    }
    const exercise: Exercise = {
      id: generateId(),
      userId: state.user.id,
      name,
      startValue,
      currentTarget: startValue,
      dailyRate: 0.01,
      streak: 0,
      totalReps: 0,
      currentDay: 1,
      daysPerWeek,
      catalogId: finalCatalogId ?? undefined,
      createdAt: new Date().toISOString(),
    };
    await storageRef.current.createExercise(exercise);
    setState(s => ({ ...s, exercises: [...s.exercises, exercise] }));
    await refreshExercise(exercise.id);
    localStorage.setItem('fitness-addict-current-exercise', exercise.id);
  }, [state.user, state.catalogs, refreshExercise]);

  const createCatalog = useCallback(async (name: string, daysPerWeek: number) => {
    if (!storageRef.current || !state.user) throw new Error('No storage or user');
    const catalog: Catalog = {
      id: generateId(),
      userId: state.user.id,
      name: name.trim(),
      daysPerWeek,
      createdAt: new Date().toISOString(),
    };
    await storageRef.current.createCatalog(catalog);
    setState(s => ({ ...s, catalogs: [...s.catalogs, catalog] }));
    return catalog;
  }, [state.user]);

  const selectExercise = useCallback(async (id: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') return;
    localStorage.setItem('fitness-addict-current-exercise', id);
    await refreshExercise(id);
  }, [refreshExercise]);

  const setExerciseCatalog = useCallback(async (exerciseId: string, catalogId: string | null) => {
    if (!storageRef.current) return;
    await storageRef.current.updateExercise(exerciseId, { catalogId: catalogId ?? undefined });
    setState(s => ({
      ...s,
      exercises: s.exercises.map(e => e.id === exerciseId ? { ...e, catalogId: catalogId ?? undefined } : e),
      currentExercise: s.currentExercise?.id === exerciseId
        ? { ...s.currentExercise, catalogId: catalogId ?? undefined }
        : s.currentExercise,
    }));
    await refreshExercise(exerciseId);
  }, [refreshExercise]);

  const deleteExercise = useCallback(async (id: string) => {
    if (!storageRef.current) return;
    const storage = storageRef.current;
    await storage.deleteExercise(id);

    const wasCurrent = state.currentExercise?.id === id;
    const remaining = state.exercises.filter(e => e.id !== id);

    setState(s => ({
      ...s,
      exercises: remaining,
      currentExercise: wasCurrent ? null : s.currentExercise,
      todayLog: wasCurrent ? null : s.todayLog,
      allLogs: wasCurrent ? [] : s.allLogs,
    }));

    if (wasCurrent && remaining.length > 0) {
      await refreshExerciseStatic(storage, remaining[0].id, setState);
      localStorage.setItem('fitness-addict-current-exercise', remaining[0].id);
    }
  }, [state.currentExercise, state.exercises]);

  const completeDay = useCallback(async (completed: number) => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    localStorage.setItem(
      `bicek-snapshot-${exercise.id}`,
      JSON.stringify({
        currentTarget: exercise.currentTarget,
        dailyRate: exercise.dailyRate,
        streak: exercise.streak,
        totalReps: exercise.totalReps,
        currentDay: exercise.currentDay,
      }),
    );

    const recentLogs = await storage.getRecentLogs(exercise.id, 10);
    const effectiveDpw = getEffectiveDaysPerWeek(exercise);

    const { updatedExercise, log } = processDay(
      exercise,
      completed,
      recentLogs,
      state.isRestDay,
      effectiveDpw,
    );

    const dailyLog: DailyLog = { ...log, id: generateId() };
    await storage.createDailyLog(dailyLog);
    await storage.updateExercise(exercise.id, updatedExercise);
    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.isRestDay, refreshExercise, getEffectiveDaysPerWeek]);

  const addMoreReps = useCallback(async (additional: number) => {
    if (!storageRef.current || !state.currentExercise || !state.todayLog) return;
    if (state.todayLog.isRestDay || additional <= 0) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;
    const log = state.todayLog;

    const newCompleted = log.completed + additional;
    await storage.updateDailyLog(log.id, { completed: newCompleted });

    const recentLogs = await storage.getRecentLogs(exercise.id, 10);
    const prevLog = recentLogs.find(l => l.id === log.id);
    if (prevLog) prevLog.completed = newCompleted;

    const effectiveDpw = getEffectiveDaysPerWeek(exercise);
    const { updatedExercise } = processDay(
      {
        ...exercise,
        currentTarget: exercise.currentTarget,
        totalReps: exercise.totalReps - log.completed,
      },
      newCompleted,
      recentLogs,
      false,
      effectiveDpw,
    );

    await storage.updateExercise(exercise.id, updatedExercise);
    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.todayLog, refreshExercise, getEffectiveDaysPerWeek]);

  const skipRestDay = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    localStorage.setItem(
      `bicek-snapshot-${exercise.id}`,
      JSON.stringify({
        currentTarget: exercise.currentTarget,
        dailyRate: exercise.dailyRate,
        streak: exercise.streak,
        totalReps: exercise.totalReps,
        currentDay: exercise.currentDay,
      }),
    );

    const log: DailyLog = {
      id: generateId(),
      exerciseId: exercise.id,
      dayNumber: exercise.currentDay,
      target: Math.floor(exercise.currentTarget),
      completed: 0,
      date: todayISO(),
      isRestDay: true,
    };

    await storage.createDailyLog(log);
    await storage.updateExercise(exercise.id, {
      currentDay: exercise.currentDay + 1,
    });
    await refreshExercise(exercise.id);
  }, [state.currentExercise, refreshExercise]);

  const markTodayRest = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise || state.todayLog) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    localStorage.setItem(
      `bicek-snapshot-${exercise.id}`,
      JSON.stringify({
        currentTarget: exercise.currentTarget,
        dailyRate: exercise.dailyRate,
        streak: exercise.streak,
        totalReps: exercise.totalReps,
        currentDay: exercise.currentDay,
      }),
    );

    const log: DailyLog = {
      id: generateId(),
      exerciseId: exercise.id,
      dayNumber: exercise.currentDay,
      target: Math.floor(exercise.currentTarget),
      completed: 0,
      date: todayISO(),
      isRestDay: true,
    };

    await storage.createDailyLog(log);
    await storage.updateExercise(exercise.id, {
      currentDay: exercise.currentDay + 1,
    });
    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.todayLog, refreshExercise]);

  const undoTodayRest = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise || !state.todayLog) return;
    if (!state.todayLog.isRestDay) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    await storage.deleteDailyLog(state.todayLog.id);
    await storage.updateExercise(exercise.id, {
      currentDay: exercise.currentDay - 1,
    });
    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.todayLog, refreshExercise]);

  const markCatalogRestDay = useCallback(async (catalogId: string) => {
    if (!storageRef.current || !state.user) return;
    const storage = storageRef.current;
    const exercises = await storage.getExercisesByCatalog(catalogId);
    const today = todayISO();
    for (const ex of exercises) {
      const existing = await storage.getTodayLog(ex.id);
      if (existing) continue;
      const log: DailyLog = {
        id: generateId(),
        exerciseId: ex.id,
        dayNumber: ex.currentDay,
        target: Math.floor(ex.currentTarget),
        completed: 0,
        date: today,
        isRestDay: true,
        catalogRest: true,
      };
      await storage.createDailyLog(log);
      await storage.updateExercise(ex.id, { currentDay: ex.currentDay + 1 });
    }
    if (state.currentExercise && exercises.some(e => e.id === state.currentExercise?.id)) {
      await refreshExercise(state.currentExercise.id);
    }
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.user, state.currentExercise, refreshExercise]);

  const undoCatalogRestDay = useCallback(async (catalogId: string) => {
    if (!storageRef.current) return;
    const storage = storageRef.current;
    const exercises = await storage.getExercisesByCatalog(catalogId);
    const today = todayISO();
    for (const ex of exercises) {
      const log = await storage.getTodayLog(ex.id);
      if (log?.isRestDay && (log as DailyLog & { catalogRest?: boolean }).catalogRest) {
        await storage.deleteDailyLog(log.id);
        await storage.updateExercise(ex.id, { currentDay: ex.currentDay - 1 });
      }
    }
    if (state.currentExercise && exercises.some(e => e.id === state.currentExercise?.id)) {
      await refreshExercise(state.currentExercise.id);
    }
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.currentExercise, refreshExercise]);

  const resetToday = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    if (state.todayLog) {
      await storage.deleteDailyLog(state.todayLog.id);

      const snapshotKey = `bicek-snapshot-${exercise.id}`;
      const raw = localStorage.getItem(snapshotKey);
      if (raw) {
        const snapshot = JSON.parse(raw);
        await storage.updateExercise(exercise.id, snapshot);
        localStorage.removeItem(snapshotKey);
      } else {
        await storage.updateExercise(exercise.id, {
          currentDay: exercise.currentDay - 1,
        });
      }
    }

    const setsKey = `bicek-sets-${exercise.id}-${todayISO()}`;
    localStorage.removeItem(setsKey);

    await refreshExercise(exercise.id);
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.currentExercise, state.todayLog, refreshExercise]);

  const editPastLog = useCallback(async (logId: string, completed: number) => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    const log = state.allLogs.find(l => l.id === logId);
    if (!log) return;

    const prevCompleted = log.isRestDay ? 0 : log.completed;

    await storage.updateDailyLog(logId, {
      completed,
      isRestDay: false,
    });

    const repsDelta = completed - prevCompleted;
    if (repsDelta !== 0) {
      await storage.updateExercise(exercise.id, {
        totalReps: exercise.totalReps + repsDelta,
      });
    }

    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.allLogs, refreshExercise]);

  const getRestBudget = useCallback(() => {
    if (!state.currentExercise) return { total: 0, used: 0, remaining: 0 };
    const dpw = getEffectiveDaysPerWeek(state.currentExercise);
    const total = 7 - dpw;
    const weekDates = getWeekDates();
    const weekStartStr = dateToISO(weekDates[0]);
    const weekEndStr = dateToISO(weekDates[6]);

    const used = state.allLogs.filter(l =>
      l.isRestDay && l.date >= weekStartStr && l.date <= weekEndStr
    ).length;

    return { total, used, remaining: Math.max(0, total - used) };
  }, [state.currentExercise, state.allLogs, getEffectiveDaysPerWeek]);

  const getExerciseTodayLog = useCallback(async (exerciseId: string) => {
    if (!storageRef.current) return null;
    return storageRef.current.getTodayLog(exerciseId);
  }, []);

  const getRestBudgetForExercise = useCallback(async (exerciseId: string) => {
    if (!storageRef.current) return { total: 0, used: 0, remaining: 0 };
    const ex = state.exercises.find(e => e.id === exerciseId);
    if (!ex) return { total: 0, used: 0, remaining: 0 };

    const dpw = getEffectiveDaysPerWeek(ex);
    const total = 7 - dpw;
    const weekDates = getWeekDates();
    const weekStartStr = dateToISO(weekDates[0]);
    const weekEndStr = dateToISO(weekDates[6]);

    const logs = await storageRef.current.getDailyLogs(exerciseId);
    const used = logs.filter(l =>
      l.isRestDay && l.date >= weekStartStr && l.date <= weekEndStr
    ).length;

    return { total, used, remaining: Math.max(0, total - used) };
  }, [state.exercises, getEffectiveDaysPerWeek]);

  const getWeeklyGroupPreview = useCallback(async (exerciseIds: string[]) => {
    const weekDates = getWeekDates();
    const weekIso = weekDates.map(dateToISO);
    const total = exerciseIds.length;
    if (!storageRef.current || total === 0) {
      return weekIso.map(date => ({ date, isRestDay: false, completed: 0, total, hasLog: false }));
    }

    const allLogs = await Promise.all(
      exerciseIds.map(exerciseId => storageRef.current!.getDailyLogs(exerciseId))
    );

    return weekIso.map(date => {
      let restCount = 0;
      let completedCount = 0;
      let hasLog = false;
      for (const logs of allLogs) {
        const dayLog = logs.find(log => log.date === date);
        if (!dayLog) continue;
        hasLog = true;
        if (dayLog.isRestDay) {
          restCount++;
          continue;
        }
        completedCount++;
      }
      const isRestDay = total > 0 && restCount === total;
      return {
        date,
        isRestDay,
        completed: isRestDay ? 0 : completedCount,
        total,
        hasLog,
      };
    });
  }, []);

  const exportData = useCallback(async (): Promise<ExportData> => {
    if (!storageRef.current || !state.user) throw new Error('No data');
    return storageRef.current.exportAll(state.user.id);
  }, [state.user]);

  const importData = useCallback(async (data: ExportData) => {
    if (!storageRef.current) return;
    await storageRef.current.importAll(data);
    const user = data.user;
    const catalogs = data.catalogs ?? [];
    const exercises = data.exercises;
    setState(s => ({ ...s, user, catalogs, exercises }));
    if (exercises.length > 0) {
      await refreshExercise(exercises[0].id);
    }
  }, [refreshExercise]);

  const getWeekTotal = useCallback(() => {
    const weekStart = getWeekStart();
    return state.allLogs
      .filter(l => !l.isRestDay && new Date(l.date) >= weekStart)
      .reduce((sum, l) => sum + l.completed, 0);
  }, [state.allLogs]);

  const getMonthTotal = useCallback(() => {
    const monthStart = getMonthStart();
    return state.allLogs
      .filter(l => !l.isRestDay && new Date(l.date) >= monthStart)
      .reduce((sum, l) => sum + l.completed, 0);
  }, [state.allLogs]);

  const getAllTimeTotal = useCallback(() => {
    return state.currentExercise?.totalReps ?? 0;
  }, [state.currentExercise]);

  const getDebugInfo = useCallback((): DebugInfo | null => {
    if (!state.currentExercise) return null;
    const ex = state.currentExercise;
    const dpw = getEffectiveDaysPerWeek(ex);
    return {
      dailyRate: ex.dailyRate,
      effectiveRate: effectiveRate(ex.dailyRate, dpw),
      daysPerWeek: dpw,
      currentDay: ex.currentDay,
      isRestDay: state.isRestDay,
      rawTarget: advanceTarget(ex.currentTarget, ex.dailyRate, dpw),
      streak: ex.streak,
    };
  }, [state.currentExercise, state.isRestDay, getEffectiveDaysPerWeek]);

  const setDebugDailyRate = useCallback(async (rate: number) => {
    if (!storageRef.current || !state.currentExercise) return;
    await storageRef.current.updateExercise(state.currentExercise.id, { dailyRate: rate });
    await refreshExercise(state.currentExercise.id);
  }, [state.currentExercise, refreshExercise]);

  const simulateNextDay = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise) return;
    const target = Math.floor(state.currentExercise.currentTarget);
    await completeDay(target);
  }, [state.currentExercise, completeDay]);

  const setDebugMode = useCallback((on: boolean) => {
    setState(s => ({ ...s, debugMode: on }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        loginLocal,
        loginEmail,
        signupEmail,
        loginGoogle,
        logout,
        addExercise,
        createCatalog,
        selectExercise,
        setExerciseCatalog,
        deleteExercise,
        markCatalogRestDay,
        undoCatalogRestDay,
        getEffectiveDaysPerWeek,
        getCatalogForExercise,
        completeDay,
        addMoreReps,
        skipRestDay,
        markTodayRest,
        undoTodayRest,
        resetToday,
        editPastLog,
        getRestBudget,
        getExerciseTodayLog,
        getRestBudgetForExercise,
        getWeeklyGroupPreview,
        exportData,
        importData,
        getWeekTotal,
        getMonthTotal,
        getAllTimeTotal,
        getDebugInfo,
        setDebugDailyRate,
        simulateNextDay,
        setDebugMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

async function getCatalogRestToday(storage: StorageAdapter, catalogId: string): Promise<boolean> {
  const exercises = await storage.getExercisesByCatalog(catalogId);
  if (exercises.length === 0) return false;
  const log = await storage.getTodayLog(exercises[0].id);
  return !!(log?.isRestDay && (log as DailyLog & { catalogRest?: boolean }).catalogRest);
}

async function backfillMissedDays(storage: StorageAdapter, exerciseId: string) {
  const ex = await storage.getExercise(exerciseId);
  if (!ex) return;

  const allLogs = await storage.getDailyLogs(exerciseId);
  if (allLogs.length === 0) return;

  const logDates = new Set(allLogs.map(l => l.date));
  const sorted = [...allLogs].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sorted[sorted.length - 1].date;

  const today = todayISO();
  if (lastDate >= today) return;

  const d = new Date(lastDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const todayDate = new Date(today + 'T00:00:00');

  let offset = 0;
  while (d < todayDate) {
    const ds = dateToISO(d);
    if (!logDates.has(ds)) {
      await storage.createDailyLog({
        id: generateId(),
        exerciseId,
        dayNumber: ex.currentDay + offset,
        target: Math.floor(ex.currentTarget),
        completed: 0,
        date: ds,
        isRestDay: true,
      });
      offset++;
    }
    d.setDate(d.getDate() + 1);
  }

  if (offset > 0) {
    await storage.updateExercise(exerciseId, {
      currentDay: ex.currentDay + offset,
    });
  }
}

async function refreshExerciseStatic(
  storage: StorageAdapter,
  exerciseId: string,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) {
  await backfillMissedDays(storage, exerciseId);

  const ex = await storage.getExercise(exerciseId);
  if (!ex) return;
  const todayLog = await storage.getTodayLog(exerciseId);
  let isRest = todayLog?.isRestDay ?? false;
  if (!isRest && ex.catalogId) {
    isRest = await getCatalogRestToday(storage, ex.catalogId);
  }
  const allLogs = await storage.getDailyLogs(exerciseId);
  if (!isRest) {
    const recentLogs = await storage.getRecentLogs(exerciseId, 10);
    const catalog = ex.catalogId ? await storage.getCatalog(ex.catalogId) : null;
    const effectiveDpw = catalog ? catalog.daysPerWeek : (ex.daysPerWeek ?? 7);
    isRest = shouldRestDay(ex, recentLogs, effectiveDpw);
  }

  setState(s => ({
    ...s,
    currentExercise: ex,
    todayLog,
    allLogs,
    isRestDay: isRest,
  }));
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
