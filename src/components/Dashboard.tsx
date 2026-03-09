'use client';

import { useApp } from '@/hooks/useApp';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { baseExpPerRep } from '@/lib/xp';
import AddExercise from './AddExercise';
import DebugForecast from './DebugForecast';
import DebugPanel from './DebugPanel';
import ExerciseSettings from './ExerciseSettings';
import ExerciseList from './ExerciseList';
import SideMenu from './SideMenu';
import StatsCard from './StatsCard';
import TodayCard from './TodayCard';
import WeekForecast from './WeekForecast';
import XpSummaryCard from './XpSummaryCard';

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseIdFromUrl = searchParams.get('exercise');
  const { user, exercises, currentExercise, selectExercise, getLevelInfo } = useApp();
  const levelInfo = getLevelInfo();
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [levelSectionOpen, setLevelSectionOpen] = useState(false);

  const hasExercises = exercises.length > 0;
  const idFromUrl = exerciseIdFromUrl?.trim();
  const validExerciseId = idFromUrl && exercises.some(e => e.id === idFromUrl) ? idFromUrl : null;
  const view = validExerciseId ? 'exercise' : 'list';

  useEffect(() => {
    if (validExerciseId && currentExercise?.id !== validExerciseId) {
      selectExercise(validExerciseId);
    }
  }, [validExerciseId, currentExercise?.id, selectExercise]);

  useEffect(() => {
    if (exerciseIdFromUrl !== null && !validExerciseId) {
      router.replace('/');
    }
  }, [exerciseIdFromUrl, validExerciseId, router]);

  if (!user) return null;

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
            <button
              type="button"
              onClick={() => {
                if (exercises.length > 0) {
                  router.push('/');
                }
              }}
              className="text-lg font-black text-ink tracking-tight active:scale-[0.97] transition-transform flex flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-0">
                BICEK<span className="text-emerald-500">.</span>
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLevelSectionOpen((v) => !v)}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-sm font-bold tabular-nums transition-colors
                ${levelSectionOpen ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-field text-ink-faint hover:text-ink hover:bg-edge'}`}
            >
              <span>{levelInfo.level} lvl</span>
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="w-8 h-8 flex items-center justify-center bg-field rounded-lg text-ink-soft
                hover:text-ink hover:bg-edge transition-colors text-lg"
            >
              +
            </button>
          </div>
        </div>
        {levelSectionOpen && (
          <div className="max-w-sm mx-auto px-4 pb-3 pt-0 space-y-1">
            <div className="w-full h-2 bg-field rounded-full overflow-hidden">
              <span
                className="block h-full bg-emerald-500 rounded-full transition-[width] duration-300"
                style={{ width: `${Math.min(100, levelInfo.progress * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-ink-faint tabular-nums">
              Łącznie: {levelInfo.totalXp} XP
              {levelInfo.level < 100 && (
                <> · {levelInfo.xpRemaining} do Lv.{levelInfo.level + 1}</>
              )}
            </p>
            {levelInfo.level >= 100 && (
              <p className="text-[11px] text-ink-faint tabular-nums">Maks. poziom</p>
            )}
            <p className="text-[10px] text-ink-faint/80 tabular-nums">
              1 powtórzenie = {baseExpPerRep(levelInfo.level)} exp
            </p>
          </div>
        )}
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
        ) : view === 'list' ? (
          <ExerciseList
            onSelectExercise={(id: string) => {
              router.push(`/?exercise=${id}`);
            }}
          />
        ) : (
          <>
            <WeekForecast />
            <TodayCard />
            <StatsCard />
            <DebugForecast />
          </>
        )}

        {hasExercises && view === 'exercise' && (
          <>
            <XpSummaryCard />
            <div className="h-px bg-edge my-2" />
            <ExerciseSettings />
          </>
        )}
      </main>

      {showAdd && <AddExercise onClose={() => setShowAdd(false)} />}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <DebugPanel />
    </div>
  );
}
