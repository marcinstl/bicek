'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Workout } from '@/lib/types';
import type { ExerciseKind, SetWithExercise } from '@/lib/types';
import { useSetsForWorkouts } from '@/hooks/useWorkout';

type HeatmapMetric = 'duration' | ExerciseKind;

const WEEKDAYS_PL = ['pon', 'wt', 'śr', 'czw', 'pi', 'so', 'nie'] as const;
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] as const;

function startOfDay(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayKey(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(ms: number) {
  const d = new Date(ms);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const shift = day === 0 ? -6 : 1 - day;
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + shift).getTime();
}

function addDays(ms: number, days: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function intensityClass(t: number, metric: HeatmapMetric) {
  // 5 steps (incl. empty), color matched to metric kind tag palette.
  if (t <= 0) return 'bg-gray-100/70';
  if (metric === 'weighted_reps') {
    if (t <= 0.25) return 'bg-orange-100';
    if (t <= 0.5) return 'bg-orange-200';
    if (t <= 0.75) return 'bg-orange-300';
    return 'bg-orange-500';
  }
  if (metric === 'bodyweight_reps') {
    if (t <= 0.25) return 'bg-violet-100';
    if (t <= 0.5) return 'bg-violet-200';
    if (t <= 0.75) return 'bg-violet-300';
    return 'bg-violet-500';
  }
  if (metric === 'time_based') {
    if (t <= 0.25) return 'bg-sky-100';
    if (t <= 0.5) return 'bg-sky-200';
    if (t <= 0.75) return 'bg-sky-300';
    return 'bg-sky-500';
  }
  if (metric === 'distance_per_time') {
    if (t <= 0.25) return 'bg-rose-100';
    if (t <= 0.5) return 'bg-rose-200';
    if (t <= 0.75) return 'bg-rose-300';
    return 'bg-rose-500';
  }
  // duration
  if (t <= 0.25) return 'bg-emerald-100';
  if (t <= 0.5) return 'bg-emerald-200';
  if (t <= 0.75) return 'bg-emerald-300';
  return 'bg-emerald-500';
}

export function WorkoutHeatmap({ workouts }: { workouts: Workout[] | undefined }) {
  const [metric, setMetric] = useState<HeatmapMetric>('duration');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current window (ending this week)
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [idleEnabled, setIdleEnabled] = useState(false);

  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setGridWidth(Math.max(0, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const gap = 4; // px
    const cell = 16; // px (fixed to avoid resizing jumps)
    const minCols = 10;
    const maxCols = 28;
    const safeWidth = Math.max(0, gridWidth);
    const colsRaw = safeWidth > 0 ? Math.floor((safeWidth + gap) / (cell + gap)) : 16;
    const cols = Math.max(minCols, Math.min(maxCols, colsRaw));
    return { cols, cell, gap };
  }, [gridWidth]);

  const windowRange = useMemo(() => {
    const cols = layout.cols;
    const today = Date.now();
    const currentWeekStart = startOfWeekMonday(today);
    const currentWeekEnd = addDays(currentWeekStart, 6);
    const windowEnd = addDays(currentWeekEnd, -weekOffset * 7);
    const windowStart = addDays(windowEnd, -(cols * 7 - 1));
    return { windowStart, windowEnd };
  }, [layout.cols, weekOffset]);

  const visibleWorkoutIds = useMemo(() => {
    const start = windowRange.windowStart;
    const end = windowRange.windowEnd;
    const ids: string[] = [];
    for (const w of workouts ?? []) {
      if (!w.ended_at) continue;
      const ended = new Date(w.ended_at).getTime();
      if (ended < start || ended > end) continue;
      ids.push(w.id);
    }
    return ids;
  }, [workouts, windowRange.windowStart, windowRange.windowEnd]);

  useEffect(() => {
    // Start fetching heavy data on idle while user stays on this page.
    let cancelled = false;
    const enable = () => {
      if (cancelled) return;
      setIdleEnabled(true);
    };
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(enable, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(enable, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  const setsQuery = useSetsForWorkouts(visibleWorkoutIds, idleEnabled);
  const setsReady = setsQuery.isSuccess;

  const { grid, monthLabels, maxValue } = useMemo(() => {
    const cols = layout.cols;
    const today = Date.now();
    const windowStart = windowRange.windowStart;
    const windowEnd = windowRange.windowEnd;

    const byDay = new Map<string, number>();
    for (const w of workouts ?? []) {
      if (!w.ended_at) continue;
      const endedMs = new Date(w.ended_at).getTime();
      const startedMs = new Date(w.started_at).getTime();
      const dKey = dayKey(endedMs);
      const durationMin = Math.max(0, Math.round((endedMs - startedMs) / 60000));
      const add = metric === 'duration' ? durationMin : 0;
      byDay.set(dKey, (byDay.get(dKey) ?? 0) + add);
    }

    const setsByWorkout = new Map<string, SetWithExercise[]>();
    if (setsReady) {
      for (const s of setsQuery.data ?? []) {
        const arr = setsByWorkout.get(s.workout_id) ?? [];
        arr.push(s);
        setsByWorkout.set(s.workout_id, arr);
      }
    }

    if (metric !== 'duration' && setsReady) {
      // Override byDay with metric derived from sets.
      byDay.clear();
      const workoutById = new Map<string, Workout>();
      for (const w of workouts ?? []) workoutById.set(w.id, w);

      for (const [workoutId, sets] of setsByWorkout.entries()) {
        const w = workoutById.get(workoutId);
        if (!w?.ended_at) continue;
        const endedMs = new Date(w.ended_at).getTime();
        if (endedMs < windowStart || endedMs > windowEnd) continue;
        const dKey = dayKey(endedMs);

        let v = 0;
        for (const s of sets) {
          if (metric === 'weighted_reps') {
            if (s.exercises.kind !== 'weighted_reps') continue;
            if (s.value == null || s.reps == null) continue;
            v += s.value * s.reps;
          } else if (metric === 'bodyweight_reps') {
            if (s.exercises.kind !== 'bodyweight_reps') continue;
            v += s.reps ?? 0;
          } else if (metric === 'time_based') {
            if (s.exercises.kind !== 'time_based') continue;
            v += s.duration_seconds ?? 0;
          } else if (metric === 'distance_per_time') {
            if (s.exercises.kind !== 'distance_per_time') continue;
            v += s.distance_km ?? 0;
          }
        }
        byDay.set(dKey, (byDay.get(dKey) ?? 0) + v);
      }
    }

    let max = 0;
    const cells: Array<Array<{ key: string; dateMs: number; value: number; inFuture: boolean }>> = [];
    for (let row = 0; row < 7; row += 1) {
      cells[row] = [];
      for (let col = 0; col < cols; col += 1) {
        const dateMs = addDays(windowStart, col * 7 + row);
        const key = dayKey(dateMs);
        const value = byDay.get(key) ?? 0;
        max = Math.max(max, value);
        const inFuture = dateMs > startOfDay(today);
        cells[row].push({ key, dateMs, value, inFuture });
      }
    }

    const labels: Array<{ col: number; label: string }> = [];
    for (let col = 0; col < cols; col += 1) {
      // find first day of month within this column
      for (let row = 0; row < 7; row += 1) {
        const dateMs = addDays(windowStart, col * 7 + row);
        const d = new Date(dateMs);
        if (d.getDate() === 1) {
          labels.push({ col, label: MONTHS_PL[d.getMonth()] });
          break;
        }
      }
    }

    return { grid: cells, monthLabels: labels, maxValue: max };
  }, [
    workouts,
    metric,
    layout.cols,
    windowRange.windowStart,
    windowRange.windowEnd,
    setsReady,
    setsQuery.data,
  ]);

  const canGoForward = weekOffset > 0;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Activity</p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
            aria-label="Previous week"
            title="Previous week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            disabled={!canGoForward}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            aria-label="Next week"
            title="Next week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <label className="sr-only" htmlFor="heatmap-metric">
          Heatmap metric
        </label>
        <select
          id="heatmap-metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as HeatmapMetric)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-emerald-500"
        >
          <option value="duration">Duration</option>
          <option value="weighted_reps" disabled={!setsReady}>
            Weighted reps
          </option>
          <option value="bodyweight_reps" disabled={!setsReady}>
            Bodyweight reps
          </option>
          <option value="time_based" disabled={!setsReady}>
            Time-based
          </option>
          <option value="distance_per_time" disabled={!setsReady}>
            Distance per time
          </option>
        </select>
      </div>

      <div className="flex gap-2">
        <div
          className="grid w-8 shrink-0 pb-5 pt-0 text-[10px] font-medium text-gray-400"
          style={{
            gridTemplateRows: `repeat(7, ${layout.cell}px)`,
            rowGap: `${layout.gap}px`,
          }}
        >
          {WEEKDAYS_PL.map((d) => (
            <div key={d} className="flex items-center leading-none">
              {d}
            </div>
          ))}
        </div>

        <div ref={gridWrapRef} className="min-w-0 flex-1">
          <div
            className="grid gap-[4px]"
            style={{
              gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, ${layout.cell}px)`,
              justifyContent: 'space-between',
            }}
          >
            {grid[0]?.map((_, colIdx) => (
              <div
                key={`col-${colIdx}`}
                className="flex flex-col gap-[4px]"
                style={{ width: layout.cell }}
              >
                {grid.map((row, rowIdx) => {
                  const c = row[colIdx];
                  const t = maxValue > 0 ? clamp01(c.value / maxValue) : 0;
                  const title = new Date(c.dateMs).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const subtitle = metric === 'duration' ? `${c.value} min` : String(c.value);
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}-${c.key}`}
                      title={`${title}\n${subtitle}`}
                      className={[
                        'rounded-[3px] ring-1 ring-inset ring-gray-200/70',
                        c.inFuture ? 'opacity-30' : '',
                        intensityClass(t, metric),
                      ].join(' ')}
                      style={{ width: layout.cell, height: layout.cell }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div
            className="mt-2 grid text-[10px] font-medium text-gray-400"
            style={{
              gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, ${layout.cell}px)`,
              columnGap: `${layout.gap}px`,
              justifyContent: 'space-between',
            }}
          >
            {Array.from({ length: grid[0]?.length ?? 0 }).map((_, col) => {
              const label = monthLabels.find((m) => m.col === col)?.label ?? '';
              return (
                <div key={`m-${col}`} className="h-3 leading-3" style={{ width: layout.cell }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

