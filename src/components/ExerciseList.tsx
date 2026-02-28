'use client';

import { useEffect, useMemo, useState } from 'react';
import { Coffee } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { dateToISO, getDayLabel, getWeekDates, todayISO } from '@/lib/utils';
import type { DailyLog, Exercise } from '@/lib/types';

type Budget = { total: number; used: number; remaining: number };

interface ExerciseListProps {
  onSelectExercise: (id: string) => void | Promise<void>;
}

export default function ExerciseList({ onSelectExercise }: ExerciseListProps) {
  const { exercises, currentExercise, catalogs } = useApp();

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

  const groups = exercises.reduce<{ key: string; label: string; items: Exercise[] }[]>(
    (acc, ex) => {
      const key = ex.catalogId ?? '__none__';
      const label = ex.catalogId
        ? (catalogs.find(c => c.id === ex.catalogId)?.name ?? 'Katalog')
        : 'Bez katalogu';
      let group = acc.find(g => g.key === key);
      if (!group) {
        group = { key, label, items: [] };
        acc.push(group);
      }
      group.items.push(ex);
      return acc;
    },
    [],
  );

  const grouped = [...groups].sort((a, b) => {
    if (a.key === '__none__') return -1;
    if (b.key === '__none__') return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="space-y-4">
      {grouped.map(({ key, label, items }) => (
        <div
          key={key}
          className="bg-panel border border-edge rounded-2xl overflow-hidden"
        >
          <CatalogHeader catalogKey={key} label={label} items={items} />
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

interface WeeklyGroupDay {
  date: string;
  isRestDay: boolean;
  completed: number;
  total: number;
  hasLog: boolean;
}

function CatalogHeader({
  catalogKey,
  label,
  items,
}: {
  catalogKey: string;
  label: string;
  items: Exercise[];
}) {
  const {
    getWeeklyGroupPreview,
    markCatalogRestDay,
    undoCatalogRestDay,
    setsVersion,
  } = useApp();
  const [weekPreview, setWeekPreview] = useState<WeeklyGroupDay[]>([]);
  const [busy, setBusy] = useState(false);

  const today = todayISO();
  const weekDates = useMemo(() => getWeekDates(), [today]);
  const exerciseIds = useMemo(() => items.map(ex => ex.id), [items]);
  const exerciseIdsKey = useMemo(() => exerciseIds.join('|'), [exerciseIds]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const ids = exerciseIdsKey.length > 0 ? exerciseIdsKey.split('|') : [];
      const preview = await getWeeklyGroupPreview(ids);
      if (!active) return;
      setWeekPreview(preview);
    };
    load();
    return () => {
      active = false;
    };
  }, [exerciseIdsKey, getWeeklyGroupPreview, setsVersion]);

  const todaySummary = weekPreview.find(day => day.date === today);
  const canToggleCatalogRest = catalogKey !== '__none__';
  const isCatalogRestToday = !!(canToggleCatalogRest && todaySummary?.isRestDay);

  const handleToggleCatalogRest = async () => {
    if (!canToggleCatalogRest || busy) return;
    setBusy(true);
    try {
      if (isCatalogRestToday) {
        await undoCatalogRestDay(catalogKey);
      } else {
        await markCatalogRestDay(catalogKey);
      }
      const updatedPreview = await getWeeklyGroupPreview(exerciseIds);
      setWeekPreview(updatedPreview);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-2.5 bg-field/50 border-b border-edge space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">
          {label}
        </span>
        {canToggleCatalogRest && (
          <button
            type="button"
            onClick={handleToggleCatalogRest}
            disabled={busy}
            title={isCatalogRestToday ? 'Cofnij przerwę katalogu' : 'Przerwa dla całego katalogu'}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors
              ${isCatalogRestToday
                ? 'text-amber-500 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-ink-faint border-edge bg-panel hover:text-ink-soft hover:border-amber-500/30'}
              ${busy ? 'opacity-60 cursor-wait' : ''}
            `}
          >
            <Coffee className="w-[14px] h-[14px]" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date, index) => {
          const ds = dateToISO(date);
          const isToday = ds === today;
          const summary = weekPreview.find(day => day.date === ds);
          return (
            <div
              key={index}
              className={`rounded-lg border px-1 py-1 text-center
                ${isToday
                  ? 'bg-emerald-500/15 border-emerald-500/30'
                  : 'border-edge bg-panel/70'
                }`}
            >
              <div className={`text-[9px] uppercase tracking-wider mb-0.5
                ${isToday ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-ink-faint'}
              `}>
                {getDayLabel(date)}
              </div>
              {summary?.isRestDay ? (
                <div className="text-[10px] font-medium text-amber-500 dark:text-amber-400/70">Przerwa</div>
              ) : ds < today && !summary?.hasLog ? (
                <div className="text-ink-faint text-[10px]">—</div>
              ) : (
                <div className="text-[10px] font-semibold tabular-nums text-ink-soft">
                  {summary ? `${summary.completed}/${summary.total}` : `0/${exerciseIds.length}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
            {getEffectiveDaysPerWeek(exercise)}x/tydzień
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

