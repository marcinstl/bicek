'use client';

import { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { todayISO } from '@/lib/utils';
import type { DailyLog, Exercise } from '@/lib/types';

type Budget = { total: number; used: number; remaining: number };

interface ExerciseListProps {
  onSelectExercise: (id: string) => void | Promise<void>;
}

type DayStatus = 'todo' | 'rest' | 'done';

export default function ExerciseList({ onSelectExercise }: ExerciseListProps) {
  const {
    exercises,
    currentExercise,
    getExerciseTodayLog,
    getRestBudgetForExercise,
    markExerciseRestDay,
    setsVersion,
  } = useApp();
  const [statusById, setStatusById] = useState<Record<string, DayStatus>>({});
  const [restBusy, setRestBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next: Record<string, DayStatus> = {};
      for (const ex of exercises) {
        const log = await getExerciseTodayLog(ex.id);
        if (!active) return;
        if (!log) {
          next[ex.id] = 'todo';
          continue;
        }
        if (log.isRestDay) {
          next[ex.id] = 'rest';
          continue;
        }
        next[ex.id] = log.completed >= log.target ? 'done' : 'todo';
      }
      if (active) setStatusById(next);
    };
    load();
    return () => {
      active = false;
    };
  }, [exercises, getExerciseTodayLog, setsVersion]);

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

  const toDo = exercises.filter(ex => statusById[ex.id] === 'todo');
  const rest = exercises.filter(ex => statusById[ex.id] === 'rest');
  const done = exercises.filter(ex => statusById[ex.id] === 'done');

  const handleMarkAllRest = async () => {
    if (restBusy || toDo.length === 0) return;
    setRestBusy(true);
    try {
      for (const ex of toDo) {
        const b = await getRestBudgetForExercise(ex.id);
        if (b.remaining > 0) await markExerciseRestDay(ex.id);
      }
    } finally {
      setRestBusy(false);
    }
  };

  const groups: { key: string; label: string; items: Exercise[]; showRestButton?: boolean }[] = [];
  if (toDo.length > 0) groups.push({ key: 'todo', label: 'Do zrobienia', items: toDo, showRestButton: true });
  if (rest.length > 0) groups.push({ key: 'rest', label: 'Przerwa', items: rest });
  if (done.length > 0) groups.push({ key: 'done', label: 'Zakończone', items: done });

  return (
    <div className="space-y-4">
      {groups.map(({ key, label, items, showRestButton }) => (
        <div
          key={key}
          className="bg-panel border border-edge rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-2.5 bg-field/50 border-b border-edge flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">
              {label}
            </span>
            {showRestButton && (
              <button
                type="button"
                onClick={handleMarkAllRest}
                disabled={restBusy}
                title="Przerwa na dziś dla wszystkich z grupy (jeśli mają przerwy do wykorzystania)"
                className="w-7 h-7 rounded-lg border border-edge bg-panel flex items-center justify-center
                  text-ink-faint hover:text-amber-500 hover:border-amber-500/30 transition-colors disabled:opacity-50"
              >
                <Coffee className="w-[14px] h-[14px]" strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div className="p-3 space-y-2">
            {items.map(ex => (
              <ExerciseListCard
                key={ex.id}
                exercise={ex}
                selected={currentExercise?.id === ex.id}
                onSelect={onSelectExercise}
              />
            ))}
          </div>
        </div>
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
  const { getExerciseTodayLog, getRestBudgetForExercise, getEffectiveDaysPerWeek } = useApp();
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
  const target = Math.floor(exercise.currentTarget);

  let completed = 0;
  if (todayLog && !todayLog.isRestDay) {
    completed = todayLog.completed;
  } else if (!todayLog && setsTotal > 0) {
    completed = setsTotal;
  }

  const hasProgress = completed > 0;
  const targetForDone = todayLog && !todayLog.isRestDay ? todayLog.target : target;
  const done = !isRestDay && hasProgress && completed >= targetForDone;

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
          <div className="text-[11px] text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{getEffectiveDaysPerWeek(exercise)}x/tydzień</span>
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
        <div className={`flex items-center gap-1.5 mt-3 ${budget.remaining === 0 ? 'text-red-500/70' : ''}`}>
          {Array.from({ length: budget.total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                budget.remaining === 0
                  ? i < budget.used
                    ? 'bg-red-400/40'
                    : 'bg-red-300/25'
                  : i < budget.used
                    ? 'bg-amber-500/50'
                    : 'bg-emerald-500/40'
              }`}
            />
          ))}
          <span className="text-[10px] ml-1 text-inherit">
            {budget.remaining > 0
              ? `${budget.remaining} ${budget.remaining === 1 ? 'przerwa' : 'przerwy'} do wykorzystania`
              : 'Brak przerw'}
          </span>
        </div>
      )}
    </button>
  );
}
