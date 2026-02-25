'use client';

import { useApp } from '@/hooks/useApp';
import { useState } from 'react';
import AddExercise from './AddExercise';
import DebugForecast from './DebugForecast';
import DebugPanel from './DebugPanel';
import ExerciseSelector from './ExerciseSelector';
import ExerciseSettings from './ExerciseSettings';
import ProgressChart from './ProgressChart';
import SideMenu from './SideMenu';
import StatsCard from './StatsCard';
import TodayCard from './TodayCard';
import WeekForecast from './WeekForecast';

export default function Dashboard() {
  const { user, exercises, currentExercise } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const hasExercises = exercises.length > 0 && currentExercise;

  return (
    <div className="min-h-screen bg-base pb-32">
      <header className="sticky top-0 z-40 bg-header-bg backdrop-blur-xl border-b border-edge">
        <div className="max-w-sm mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="w-8 h-8 flex flex-col items-center justify-center gap-1 rounded-lg
                hover:bg-field transition-colors"
            >
              <span className="block w-4 h-0.5 bg-ink-soft rounded-full" />
              <span className="block w-4 h-0.5 bg-ink-soft rounded-full" />
              <span className="block w-4 h-0.5 bg-ink-soft rounded-full" />
            </button>
            <div className="text-lg font-black text-ink tracking-tight">
              bicek<span className="text-emerald-500">.</span>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 flex items-center justify-center bg-field rounded-lg text-ink-soft
              hover:text-ink hover:bg-edge transition-colors text-lg"
          >
            +
          </button>
        </div>
      </header>

      <main className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {!hasExercises ? (
          <div className="text-center py-16 space-y-4">
            <div className="text-ink-faint text-sm">Brak ćwiczeń</div>
            <button
              onClick={() => setShowAdd(true)}
              className="py-3 px-6 bg-emerald-500 text-white rounded-xl font-semibold text-sm
                hover:bg-emerald-400 transition-all active:scale-[0.98]"
            >
              Dodaj pierwsze ćwiczenie
            </button>
          </div>
        ) : (
          <>
            <ExerciseSelector />
            <WeekForecast />
            <TodayCard />
            <StatsCard />
            <ProgressChart />
            <DebugForecast />
          </>
        )}

        <div className="h-px bg-edge my-2" />
        {currentExercise && <ExerciseSettings />}
      </main>

      {showAdd && <AddExercise onClose={() => setShowAdd(false)} />}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <DebugPanel />
    </div>
  );
}
