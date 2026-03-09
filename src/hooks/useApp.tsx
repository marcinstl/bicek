'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, Exercise, DailyLog, ExportData, AuthMode, DebugInfo } from '@/lib/types';
import { StorageAdapter } from '@/lib/storage';
import { IDBStorage } from '@/lib/idb-storage';
import { SupabaseStorage } from '@/lib/supabase-storage';
import { getSupabase } from '@/lib/supabase';
import { processDay, shouldRestDay, advanceTarget, effectiveRate } from '@/lib/progression';
import { xpForSession, levelFromTotalXp, totalXpForLevel, xpToNextLevel } from '@/lib/xp';
import { generateId, todayISO, dateToISO, getWeekStart, getWeekDates, getMonthStart } from '@/lib/utils';

interface AppState {
  user: User | null;
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
  addExercise: (name: string, startValue: number, daysPerWeek?: number) => Promise<void>;
  selectExercise: (id: string) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  getEffectiveDaysPerWeek: (exercise: Exercise) => number;
  completeDay: (completed: number, sets?: number[]) => Promise<void>;
  addMoreReps: (additional: number) => Promise<void>;
  skipRestDay: () => Promise<void>;
  markTodayRest: () => Promise<void>;
  markExerciseRestDay: (exerciseId: string) => Promise<void>;
  undoTodayRest: () => Promise<void>;
  resetToday: () => Promise<void>;
  editPastLog: (logId: string, completed: number) => Promise<void>;
  getRestBudget: () => { total: number; used: number; remaining: number };
  getExerciseTodayLog: (exerciseId: string) => Promise<DailyLog | null>;
  getRestBudgetForExercise: (exerciseId: string) => Promise<{ total: number; used: number; remaining: number }>;
  exportData: () => Promise<ExportData>;
  importData: (data: ExportData) => Promise<void>;
  getWeekTotal: () => number;
  getMonthTotal: () => number;
  getMonthXpTotal: () => number;
  getAllTimeTotal: () => number;
  getDebugInfo: () => DebugInfo | null;
  getLevelInfo: () => { level: number; totalXp: number; xpToNext: number; xpRemaining: number; progress: number };
  setDebugDailyRate: (rate: number) => Promise<void>;
  simulateNextDay: () => Promise<void>;
  setDebugMode: (on: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const storageRef = useRef<StorageAdapter | null>(null);
  const [state, setState] = useState<AppState>({
    user: null,
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
    return exercise.daysPerWeek ?? 7;
  }, []);

  const refreshExercise = useCallback(async (exerciseId: string) => {
    if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim() === '') return;
    if (!storageRef.current) return;
    const storage = storageRef.current;

    await backfillMissedDays(storage, exerciseId);

    const ex = await storage.getExercise(exerciseId);
    if (!ex) return;

    const todayLog = await storage.getTodayLog(exerciseId);
    let isRest = todayLog?.isRestDay ?? false;
    const allLogs = await storage.getDailyLogs(exerciseId);
    if (!isRest) {
      const recentLogs = await storage.getRecentLogs(exerciseId, 10);
      const effectiveDpw = ex.daysPerWeek ?? 7;
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
          const exercises = await storage.getExercises(user.id);
          setState(s => ({ ...s, user, exercises, loading: false }));
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
            const exercises = await storage.getExercises(user.id);
            setState(s => ({ ...s, user, exercises, loading: false }));
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
    setState(s => ({ ...s, user, exercises: [], loading: false }));
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
    const exercises = await storage.getExercises(user.id);
    setState(s => ({ ...s, user, exercises, loading: false }));

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
    daysPerWeek: number = 7
  ) => {
    if (!storageRef.current || !state.user) return;
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
      createdAt: new Date().toISOString(),
      totalXpEarned: 0,
    };
    await storageRef.current.createExercise(exercise);
    setState(s => ({ ...s, exercises: [...s.exercises, exercise] }));
    await refreshExercise(exercise.id);
    localStorage.setItem('fitness-addict-current-exercise', exercise.id);
  }, [state.user, refreshExercise]);

  const selectExercise = useCallback(async (id: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') return;
    localStorage.setItem('fitness-addict-current-exercise', id);
    await refreshExercise(id);
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

  const completeDay = useCallback(async (completed: number, setsFromCaller?: number[]) => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;

    let setsToSave: number[] | undefined = setsFromCaller?.length ? setsFromCaller : undefined;
    if (setsToSave === undefined && typeof window !== 'undefined') {
      try {
        const key = `bicek-sets-${exercise.id}-${todayISO()}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as number[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setsToSave = parsed;
          }
        }
      } catch {
        // ignore
      }
    }

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

    const target = Math.floor(exercise.currentTarget);
    let xpEarned = 0;
    const finalExercise: Partial<Exercise> = { ...updatedExercise };

    if (!state.isRestDay && completed >= target && state.user) {
      const userLevel = levelFromTotalXp(state.user.totalXp ?? 0);
      xpEarned = xpForSession(completed, userLevel, exercise.dailyRate, exercise.streak);
      finalExercise.totalXpEarned = (exercise.totalXpEarned ?? 0) + xpEarned;
    }

    const dailyLog: DailyLog = {
      ...log,
      id: generateId(),
      ...(setsToSave?.length ? { sets: setsToSave } : {}),
      ...(xpEarned > 0 ? { xpEarned } : {}),
    };
    await storage.createDailyLog(dailyLog);
    await storage.updateExercise(exercise.id, finalExercise);

    if (xpEarned > 0 && state.user) {
      const newTotalXp = (state.user.totalXp ?? 0) + xpEarned;
      await storage.updateUser(state.user.id, { totalXp: newTotalXp });
      setState(s => ({
        ...s,
        user: s.user ? { ...s.user, totalXp: newTotalXp } : null,
        setsVersion: s.setsVersion + 1,
      }));
    } else {
      setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`bicek-sets-${exercise.id}-${todayISO()}`);
    }
    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.isRestDay, state.user, refreshExercise, getEffectiveDaysPerWeek]);

  const addMoreReps = useCallback(async (additional: number) => {
    if (!storageRef.current || !state.currentExercise || !state.todayLog) return;
    if (state.todayLog.isRestDay || additional <= 0) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;
    const log = state.todayLog;

    const newCompleted = log.completed + additional;
    const newSets = [...(log.sets ?? []), additional];
    await storage.updateDailyLog(log.id, { completed: newCompleted, sets: newSets });

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
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
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
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.currentExercise, state.todayLog, refreshExercise]);

  const markExerciseRestDay = useCallback(async (exerciseId: string) => {
    if (!storageRef.current) return;
    const storage = storageRef.current;
    const existing = await storage.getTodayLog(exerciseId);
    if (existing) return;
    const ex = await storage.getExercise(exerciseId);
    if (!ex) return;

    localStorage.setItem(
      `bicek-snapshot-${ex.id}`,
      JSON.stringify({
        currentTarget: ex.currentTarget,
        dailyRate: ex.dailyRate,
        streak: ex.streak,
        totalReps: ex.totalReps,
        currentDay: ex.currentDay,
      }),
    );

    const log: DailyLog = {
      id: generateId(),
      exerciseId: ex.id,
      dayNumber: ex.currentDay,
      target: Math.floor(ex.currentTarget),
      completed: 0,
      date: todayISO(),
      isRestDay: true,
    };

    await storage.createDailyLog(log);
    await storage.updateExercise(ex.id, { currentDay: ex.currentDay + 1 });
    if (state.currentExercise?.id === exerciseId) {
      await refreshExercise(exerciseId);
    }
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.currentExercise, refreshExercise]);

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
    setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
  }, [state.currentExercise, state.todayLog, refreshExercise]);

  const resetToday = useCallback(async () => {
    if (!storageRef.current || !state.currentExercise) return;
    const storage = storageRef.current;
    const exercise = state.currentExercise;
    const todayLog = state.todayLog;
    const xpToRefund = todayLog?.xpEarned ?? 0;

    if (todayLog) {
      await storage.deleteDailyLog(todayLog.id);

      const snapshotKey = `bicek-snapshot-${exercise.id}`;
      const raw = localStorage.getItem(snapshotKey);
      if (raw) {
        const snapshot = JSON.parse(raw);
        await storage.updateExercise(exercise.id, snapshot);
        localStorage.removeItem(snapshotKey);
      } else {
        const updates: Partial<Exercise> = { currentDay: exercise.currentDay - 1 };
        if (xpToRefund > 0) {
          updates.totalXpEarned = Math.max(0, (exercise.totalXpEarned ?? 0) - xpToRefund);
        }
        await storage.updateExercise(exercise.id, updates);
      }
    }

    if (xpToRefund > 0 && state.user) {
      const newTotalXp = Math.max(0, (state.user.totalXp ?? 0) - xpToRefund);
      await storage.updateUser(state.user.id, { totalXp: newTotalXp });
      setState(s => ({
        ...s,
        user: s.user ? { ...s.user, totalXp: newTotalXp } : null,
        setsVersion: s.setsVersion + 1,
      }));
    } else {
      setState(s => ({ ...s, setsVersion: s.setsVersion + 1 }));
    }

    const setsKey = `bicek-sets-${exercise.id}-${todayISO()}`;
    localStorage.removeItem(setsKey);

    await refreshExercise(exercise.id);
  }, [state.currentExercise, state.todayLog, state.user, refreshExercise]);

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

  const exportData = useCallback(async (): Promise<ExportData> => {
    if (!storageRef.current || !state.user) throw new Error('No data');
    return storageRef.current.exportAll(state.user.id);
  }, [state.user]);

  const importData = useCallback(async (data: ExportData) => {
    if (!storageRef.current) return;
    await storageRef.current.importAll(data);
    const user = data.user;
    const exercises = data.exercises;
    setState(s => ({ ...s, user, exercises }));
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

  const getMonthXpTotal = useCallback(() => {
    const monthStart = getMonthStart();
    return state.allLogs
      .filter(l => new Date(l.date) >= monthStart)
      .reduce((sum, l) => sum + (l.xpEarned ?? 0), 0);
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

  const getLevelInfo = useCallback(() => {
    const totalXp = state.user?.totalXp ?? 0;
    const level = levelFromTotalXp(totalXp);
    const xpToNext = xpToNextLevel(level);
    const currentLevelStart = totalXpForLevel(level);
    const nextLevelStart = totalXpForLevel(level + 1);
    const progress = nextLevelStart > currentLevelStart
      ? (totalXp - currentLevelStart) / (nextLevelStart - currentLevelStart)
      : 1;
    const xpRemaining = Math.max(0, nextLevelStart - totalXp);
    return { level, totalXp, xpToNext, xpRemaining, progress };
  }, [state.user?.totalXp]);

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
        selectExercise,
        deleteExercise,
        getEffectiveDaysPerWeek,
        completeDay,
        addMoreReps,
        skipRestDay,
        markTodayRest,
        markExerciseRestDay,
        undoTodayRest,
        resetToday,
        editPastLog,
        getRestBudget,
        getExerciseTodayLog,
        getRestBudgetForExercise,
        exportData,
        importData,
        getWeekTotal,
        getMonthTotal,
        getMonthXpTotal,
        getAllTimeTotal,
        getDebugInfo,
        getLevelInfo,
        setDebugDailyRate,
        simulateNextDay,
        setDebugMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
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
  const allLogs = await storage.getDailyLogs(exerciseId);
  if (!isRest) {
    const recentLogs = await storage.getRecentLogs(exerciseId, 10);
    const effectiveDpw = ex.daysPerWeek ?? 7;
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
