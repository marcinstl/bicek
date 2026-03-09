export type AuthMode = 'online' | 'local';

export interface User {
  id: string;
  mode: AuthMode;
  createdAt: string;
  /** Suma XP (level w stylu Tibii) */
  totalXp?: number;
}

export interface Exercise {
  id: string;
  userId: string;
  name: string;
  startValue: number;
  currentTarget: number;
  dailyRate: number;
  /** Konsystencja 0–1: po sesji +0.05 (dobrze), 0 (średnio), −0.05 (słabo). Stare dane: brak pola → 0. */
  consistency?: number;
  streak: number;
  totalReps: number;
  currentDay: number;
  daysPerWeek: number;
  createdAt: string;
  /** Nie zapisywane – multiplier z dailyRate i exercise.consistency. */
  xpMultiplier?: number;
  /** Suma XP zdobyta z tego ćwiczenia */
  totalXpEarned?: number;
}

export interface DailyLog {
  id: string;
  exerciseId: string;
  dayNumber: number;
  target: number;
  completed: number;
  date: string;
  isRestDay: boolean;
  /** Serie (powtórzenia w każdej serii) – zapisywane przy zakończeniu dnia */
  sets?: number[];
  /** XP zdobyte tego dnia (cap: max za osiągnięcie celu; dodatkowe powtórzenia nie dają XP) */
  xpEarned?: number;
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  user: User;
  exercises: Exercise[];
  dailyLogs: DailyLog[];
}

export interface DebugInfo {
  dailyRate: number;
  effectiveRate: number;
  daysPerWeek: number;
  currentDay: number;
  isRestDay: boolean;
  rawTarget: number;
  streak: number;
}
