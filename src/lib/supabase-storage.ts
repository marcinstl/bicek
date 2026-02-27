import { SupabaseClient } from '@supabase/supabase-js';
import { User, Exercise, DailyLog, ExportData } from './types';
import { StorageAdapter } from './storage';
import { todayISO } from './utils';

export class SupabaseStorage implements StorageAdapter {
  constructor(private supabase: SupabaseClient) {}

  async getUser(): Promise<User | null> {
    const { data: { user: authUser } } = await this.supabase.auth.getUser();
    if (!authUser) return null;

    const { data } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    return data as User | null;
  }

  async createUser(user: User): Promise<void> {
    await this.supabase.from('users').upsert(user);
  }

  async getExercises(userId: string): Promise<Exercise[]> {
    const { data } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: true });

    return (data as Exercise[]) ?? [];
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const { data } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    return data as Exercise | null;
  }

  async createExercise(exercise: Exercise): Promise<void> {
    await this.supabase.from('exercises').insert(exercise);
  }

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<void> {
    await this.supabase.from('exercises').update(updates).eq('id', id);
  }

  async deleteExercise(id: string): Promise<void> {
    await this.supabase.from('dailyLogs').delete().eq('exerciseId', id);
    await this.supabase.from('exercises').delete().eq('id', id);
  }

  async getDailyLogs(exerciseId: string): Promise<DailyLog[]> {
    const { data } = await this.supabase
      .from('dailyLogs')
      .select('*')
      .eq('exerciseId', exerciseId)
      .order('dayNumber', { ascending: true });

    return (data as DailyLog[]) ?? [];
  }

  async getRecentLogs(exerciseId: string, count: number): Promise<DailyLog[]> {
    const { data } = await this.supabase
      .from('dailyLogs')
      .select('*')
      .eq('exerciseId', exerciseId)
      .order('dayNumber', { ascending: false })
      .limit(count);

    return ((data as DailyLog[]) ?? []).reverse();
  }

  async createDailyLog(log: DailyLog): Promise<void> {
    await this.supabase.from('dailyLogs').insert(log);
  }

  async updateDailyLog(id: string, data: Partial<DailyLog>): Promise<void> {
    await this.supabase.from('dailyLogs').update(data).eq('id', id);
  }

  async deleteDailyLog(id: string): Promise<void> {
    await this.supabase.from('dailyLogs').delete().eq('id', id);
  }

  async getTodayLog(exerciseId: string): Promise<DailyLog | null> {
    const today = todayISO();
    const { data } = await this.supabase
      .from('dailyLogs')
      .select('*')
      .eq('exerciseId', exerciseId)
      .eq('date', today)
      .single();

    return data as DailyLog | null;
  }

  async exportAll(userId: string): Promise<ExportData> {
    const user = await this.getUser();
    const exercises = await this.getExercises(userId);
    const allLogs: DailyLog[] = [];

    for (const ex of exercises) {
      const logs = await this.getDailyLogs(ex.id);
      allLogs.push(...logs);
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: user!,
      exercises,
      dailyLogs: allLogs,
    };
  }

  async importAll(data: ExportData): Promise<void> {
    await this.supabase.from('users').upsert(data.user);

    for (const ex of data.exercises) {
      await this.supabase.from('exercises').upsert(ex);
    }

    for (const log of data.dailyLogs) {
      await this.supabase.from('dailyLogs').upsert(log);
    }
  }
}
