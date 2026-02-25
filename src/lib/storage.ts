import { User, Exercise, DailyLog, ExportData } from './types';

export interface StorageAdapter {
  getUser(): Promise<User | null>;
  createUser(user: User): Promise<void>;

  getExercises(userId: string): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | null>;
  createExercise(exercise: Exercise): Promise<void>;
  updateExercise(id: string, data: Partial<Exercise>): Promise<void>;
  deleteExercise(id: string): Promise<void>;

  getDailyLogs(exerciseId: string): Promise<DailyLog[]>;
  getRecentLogs(exerciseId: string, count: number): Promise<DailyLog[]>;
  createDailyLog(log: DailyLog): Promise<void>;
  updateDailyLog(id: string, data: Partial<DailyLog>): Promise<void>;
  deleteDailyLog(id: string): Promise<void>;
  getTodayLog(exerciseId: string): Promise<DailyLog | null>;

  exportAll(userId: string): Promise<ExportData>;
  importAll(data: ExportData): Promise<void>;
}
