'use client';

import { useMemo } from 'react';
import { useSetsForWorkouts, useWorkoutHistory } from '@/hooks/useWorkout';
import { getLevelProgress } from '@/lib/rpg/leveling';
import { computeSetXp } from '@/lib/rpg/xp';

export default function RpgPage() {
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory();
  const workoutIds = useMemo(() => history.map((w) => w.id), [history]);
  const { data: sets = [], isLoading: setsLoading } = useSetsForWorkouts(workoutIds, workoutIds.length > 0);

  const totalXp = useMemo(() => {
    return sets.reduce((sum, set) => {
      if (set.xp != null) return sum + set.xp;
      return sum + computeSetXp(set.exercises.kind, set);
    }, 0);
  }, [sets]);

  const progress = getLevelProgress(totalXp);
  const loading = historyLoading || (workoutIds.length > 0 && setsLoading);

  return (
    <div className="relative pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RPG & Gamification</h1>
      </div>
      
      <div className="rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Poziom {progress.level}</h2>
        <div className="w-full max-w-xs mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progress.currentLevelXp} XP</span>
            <span>{progress.nextLevelXp} XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress.progressPct}%` }} />
          </div>
          <div className="mt-3 text-left">
            {loading ? (
              <p className="text-xs text-gray-400">Liczenie XP...</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">Total: {progress.totalXp} XP</p>
                <p className="text-xs text-gray-400 mt-1">Potrzebny XP: {progress.xpToNextLevel}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
