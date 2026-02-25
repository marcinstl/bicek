'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { effectiveRate } from '@/lib/progression';
import { getWeekDates, getDayLabel, dateToISO, todayISO } from '@/lib/utils';
import { DailyLog } from '@/lib/types';
import PastDayModal from './PastDayModal';

export default function WeekForecast() {
  const { currentExercise, allLogs, getRestBudget } = useApp();
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);

  const today = todayISO();
  const weekDates = useMemo(() => getWeekDates(), [today]);
  const budget = getRestBudget();

  const logsByDate = useMemo(() => {
    const map = new Map<string, DailyLog>();
    for (const log of allLogs) {
      map.set(log.date, log);
    }
    return map;
  }, [allLogs]);

  if (!currentExercise) return null;

  const ex = currentExercise;
  const dpw = ex.daysPerWeek ?? 7;
  const rate = ex.dailyRate;

  const days = weekDates.map(date => {
    const ds = dateToISO(date);
    const isToday = ds === today;
    const isPast = ds < today;
    const isFuture = ds > today;
    const log = logsByDate.get(ds) ?? null;

    let target: number | null = null;
    let completed: number | null = null;
    let isRestDay = false;

    if (log) {
      target = log.target;
      completed = log.completed;
      isRestDay = log.isRestDay;
    } else if (isToday) {
      target = Math.floor(ex.currentTarget);
    }

    return { date, ds, isToday, isPast, isFuture, log, target, completed, isRestDay };
  });

  let projTarget = ex.currentTarget;
  const todayHasLog = !!logsByDate.get(today);
  if (todayHasLog) {
    projTarget = projTarget * (1 + effectiveRate(rate, dpw));
  }

  for (const d of days) {
    if (d.isFuture && !d.log) {
      d.target = Math.floor(projTarget);
      projTarget = projTarget * (1 + effectiveRate(rate, dpw));
    }
  }

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, i) => {
            const clickable = day.isPast && day.log;
            return (
              <button
                key={i}
                disabled={!clickable}
                onClick={() => clickable && day.log && setEditingLog(day.log)}
                className={`rounded-xl py-2 px-1 text-center transition-all
                  ${day.isToday
                    ? 'bg-emerald-500/15 border border-emerald-500/30'
                    : day.isPast && day.log
                      ? 'bg-panel border border-edge hover:border-emerald-500/30 cursor-pointer'
                      : 'bg-panel border border-edge'
                  }
                  ${!clickable ? 'cursor-default' : ''}
                `}
              >
                <div className={`text-[10px] uppercase tracking-wider mb-1
                  ${day.isToday
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-ink-faint'
                  }`}
                >
                  {getDayLabel(day.date)}
                </div>

                {day.isRestDay ? (
                  <div className="text-amber-500 dark:text-amber-400/70 text-[10px] font-medium leading-tight">
                    rest
                  </div>
                ) : day.isPast && day.log ? (
                  <div className={`text-sm font-bold tabular-nums
                    ${day.completed! >= day.target! ? 'text-emerald-500' : 'text-ink-soft'}`}
                  >
                    {day.completed}
                  </div>
                ) : day.isToday ? (
                  <div className="text-sm font-bold tabular-nums text-ink">
                    {day.target}
                  </div>
                ) : day.isFuture ? (
                  <div className="text-sm font-bold tabular-nums text-ink-faint">
                    {day.target}
                  </div>
                ) : (
                  <div className="text-ink-faint text-[10px]">—</div>
                )}
              </button>
            );
          })}
        </div>

        {budget.total > 0 && (
          <div className="flex items-center justify-center gap-1.5">
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
      </div>

      {editingLog && (
        <PastDayModal log={editingLog} onClose={() => setEditingLog(null)} />
      )}
    </>
  );
}
