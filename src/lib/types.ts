export type AuthMode = 'online' | 'local';

export interface User {
  id: string;
  mode: AuthMode;
  createdAt: string;
}

export interface Catalog {
  id: string;
  userId: string;
  name: string;
  daysPerWeek: number;
  createdAt: string;
}

export interface Exercise {
  id: string;
  userId: string;
  name: string;
  startValue: number;
  currentTarget: number;
  dailyRate: number;
  streak: number;
  totalReps: number;
  currentDay: number;
  daysPerWeek: number;
  catalogId?: string | null;
  createdAt: string;
}

export interface DailyLog {
  id: string;
  exerciseId: string;
  dayNumber: number;
  target: number;
  completed: number;
  date: string;
  isRestDay: boolean;
  catalogRest?: boolean;
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  user: User;
  catalogs?: Catalog[];
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
