'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/hooks/useApp';
import { todayISO } from '@/lib/utils';
import type { DailyLog, Exercise } from '@/lib/types';

type Budget = { total: number; used: number; remaining: number };

interface ExerciseListProps {
  onSelectExercise: (id: string) => void | Promise<void>;
}

export default function ExerciseList({ onSelectExercise }: ExerciseListProps) {
  const { exercises, currentExercise } = useApp();

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <div className="text-ink-faint text-sm">Brak ćwiczeń</div>
        <div className="text-ink-soft text-xs">
          Dodaj pierwsze ćwiczenie, aby zacząć trenować BICEK.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exercises.map(ex => (
        <ExerciseListCard
          key={ex.id}
          exercise={ex}
          selected={currentExercise?.id === ex.id}
          onSelect={onSelectExercise}
        />
      ))}
    </div>
  );
}

interface ExerciseListCardProps {
  exercise: Exercise;
  selected: boolean;
  onSelect: (id: string) => void | Promise<void>;
}

function ExerciseListCard({ exercise, selected, onSelect }: ExerciseListCardProps) {
  const { getExerciseTodayLog, getRestBudgetForExercise } = useApp();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [budget, setBudget] = useState<Budget>({ total: 0, used: 0, remaining: 0 });
  const [setsTotal, setSetsTotal] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [log, b] = await Promise.all([
        getExerciseTodayLog(exercise.id),
        getRestBudgetForExercise(exercise.id),
      ]);
      if (!active) return;
      setTodayLog(log);
      setBudget(b);
    };
    load();

    try {
      const key = `bicek-sets-${exercise.id}-${todayISO()}`;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as number[];
        if (Array.isArray(parsed)) {
          setSetsTotal(parsed.reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0));
        }
      } else {
        setSetsTotal(0);
      }
    } catch {
      setSetsTotal(0);
    }

    return () => {
      active = false;
    };
  }, [exercise.id, getExerciseTodayLog, getRestBudgetForExercise]);

  const handleSelect = () => {
    onSelect(exercise.id);
  };

  const isRestDay = todayLog?.isRestDay ?? false;
  const target = todayLog
    ? todayLog.target
    : Math.floor(exercise.currentTarget);

  let completed = 0;
  if (todayLog && !todayLog.isRestDay) {
    completed = todayLog.completed;
  } else if (!todayLog && setsTotal > 0) {
    completed = setsTotal;
  }

  const hasProgress = completed > 0;
  const done = !isRestDay && hasProgress && completed >= target;

  return (
    <button
      onClick={handleSelect}
      className={`w-full text-left bg-panel border rounded-2xl p-4 transition-all
        ${selected ? 'border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]' : 'border-edge hover:border-emerald-500/40'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-ink">
            {exercise.name}
          </div>
          <div className="text-[11px] text-ink-faint mt-0.5">
            {exercise.daysPerWeek}x/tydzień
          </div>
        </div>
        <div className="text-right">
          {isRestDay ? (
            <div className="text-xs font-medium text-amber-500">Przerwa</div>
          ) : done ? (
            <div className="text-xs font-medium text-emerald-500">Trening wykonany</div>
          ) : hasProgress ? (
            <div className="text-xs text-ink-faint">W trakcie</div>
          ) : (
            <div className="text-xs text-ink-faint">Jeszcze przed Tobą</div>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        {isRestDay ? (
          <div className="text-sm text-ink-soft">
            Dzień regeneracyjny
          </div>
        ) : (
          <div className="text-2xl font-black tabular-nums">
            <span className={done ? 'text-emerald-500' : 'text-ink'}>
              {completed}
            </span>
            <span className="text-ink-faint text-lg font-bold">/{target}</span>
          </div>
        )}
      </div>

      {budget.total > 0 && (
        <div className="flex items-center gap-1.5 mt-3">
          {Array.from({ length: budget.total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < budget.used
                  ? 'bg-amber-500/50'
                  : 'bg-emerald-500/40'
              }`}
            />
          ))}
          <span className="text-[10px] text-ink-faint ml-1">
            {budget.remaining > 0
              ? `${budget.remaining} ${budget.remaining === 1 ? 'przerwa' : 'przerwy'} do wykorzystania`
              : 'Brak przerw'}
          </span>
        </div>
      )}
    </button>
  );
}

