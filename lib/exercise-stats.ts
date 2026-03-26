import type { Exercise, ExerciseKind, Set } from '@/lib/types';
import type { ExerciseHistoryEntry } from '@/lib/api';

const KIND_TITLES: Record<ExerciseKind, string> = {
  weighted_reps: 'Weighted reps',
  bodyweight_reps: 'Bodyweight reps',
  time_based: 'Time-based',
  distance_per_time: 'Distance per time',
};

export function getExerciseKindTitle(kind: ExerciseKind): string {
  return KIND_TITLES[kind] ?? kind;
}

/** Distinct tag colors per kind (no yellow). */
const KIND_TAG_STYLES: Record<ExerciseKind, string> = {
  weighted_reps: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200/80',
  bodyweight_reps: 'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200/80',
  time_based: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200/80',
  distance_per_time: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200/80',
};

export function exerciseKindTagClassName(kind: ExerciseKind): string {
  return `inline-flex w-fit max-w-full shrink-0 items-center self-start rounded-lg px-2 py-0.5 text-xs font-medium ${KIND_TAG_STYLES[kind]}`;
}

export function resolveExerciseKind(ex: Exercise): ExerciseKind {
  if (ex.kind) return ex.kind;
  if (ex.metric_type === 'reps' && ex.unit) return 'weighted_reps';
  if (ex.metric_type === 'reps') return 'bodyweight_reps';
  if (ex.metric_type === 'time' || ex.metric_type === 'time_sec' || ex.metric_type === 'time_min') {
    return 'time_based';
  }
  return 'bodyweight_reps';
}

function workoutEndedDate(entry: ExerciseHistoryEntry): Date {
  const t = entry.workout.ended_at ?? entry.workout.started_at;
  return new Date(t);
}

function inCalendarMonth(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function inCalendarYear(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear();
}

function sumSetsMetric(sets: Set[], kind: ExerciseKind): number {
  switch (kind) {
    case 'weighted_reps':
      return sets.reduce((acc, s) => {
        if (s.value == null || s.reps == null) return acc;
        return acc + s.value * s.reps;
      }, 0);
    case 'bodyweight_reps':
      return sets.reduce((acc, s) => acc + (s.reps ?? 0), 0);
    case 'time_based':
      return sets.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
    case 'distance_per_time':
      return sets.reduce((acc, s) => acc + (s.distance_km ?? 0), 0);
    default:
      return 0;
  }
}

export interface ExercisePeriodTotals {
  week: number;
  month: number;
  year: number;
  all: number;
}

export type ExerciseHistoryRange = 'week' | 'month' | 'quarter' | 'year';

export interface ExerciseHistoryChartPoint {
  key: string;
  label: string;
  value: number;
}

export function aggregateExerciseHistoryByPeriod(
  history: ExerciseHistoryEntry[] | undefined,
  kind: ExerciseKind,
  now = new Date()
): ExercisePeriodTotals {
  const weekStart = startOfWeekMonday(now).getTime();
  const weekEnd = addDays(startOfWeekMonday(now), 7).getTime();
  const weekSets: Set[] = [];
  const monthSets: Set[] = [];
  const yearSets: Set[] = [];
  const allSets: Set[] = [];

  for (const entry of history ?? []) {
    const d = workoutEndedDate(entry);
    const endedMs = d.getTime();
    const sets = entry.sets;
    allSets.push(...sets);
    if (endedMs >= weekStart && endedMs < weekEnd) weekSets.push(...sets);
    if (inCalendarYear(d, now)) {
      yearSets.push(...sets);
      if (inCalendarMonth(d, now)) monthSets.push(...sets);
    }
  }

  return {
    week: sumSetsMetric(weekSets, kind),
    month: sumSetsMetric(monthSets, kind),
    year: sumSetsMetric(yearSets, kind),
    all: sumSetsMetric(allSets, kind),
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function startOfWeekMonday(d: Date): Date {
  const date = startOfDay(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const shift = day === 0 ? -6 : 1 - day;
  return addDays(date, shift);
}

function endOfWeekMonday(d: Date): Date {
  return addDays(startOfWeekMonday(d), 6);
}

function plShortMonthLabel(monthZeroBased: number): string {
  const labels = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  return labels[monthZeroBased] ?? '';
}

function isoWeekStartMonday(d: Date): Date {
  return startOfWeekMonday(d);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function addQuarters(d: Date, quarters: number): Date {
  return addMonths(d, quarters * 3);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function yearKey(d: Date): string {
  return String(d.getFullYear());
}

function startOfQuarter(d: Date): Date {
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), qMonth, 1);
}

function quarterKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function weekKey(weekStart: Date): string {
  // key for week bucket: Monday date in ISO-ish form
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(
    weekStart.getDate()
  ).padStart(2, '0')}`;
}

function label3(dayLine: string, monthLine: string, yearLine: string): string {
  return `${dayLine}\n${monthLine}\n${yearLine}`;
}

export function aggregateExerciseHistoryForRange(
  history: ExerciseHistoryEntry[] | undefined,
  kind: ExerciseKind,
  range: ExerciseHistoryRange,
  now = new Date()
): ExerciseHistoryChartPoint[] {
  const source = history ?? [];
  const points = new Map<string, number>();
  const labels = new Map<string, string>();

  function initPoint(key: string, label: string) {
    points.set(key, 0);
    labels.set(key, label);
  }

  if (range === 'week') {
    // Show last up to 10 weeks, each bar = week starting Monday.
    const WEEKS = 10;
    const thisWeekStart = isoWeekStartMonday(now);
    const starts: Date[] = [];
    for (let i = WEEKS - 1; i >= 0; i -= 1) starts.push(addDays(thisWeekStart, -7 * i));

    let prevMonth = -1;
    let prevYear = -1;
    for (const ws of starts) {
      const key = weekKey(ws);
      const day = String(ws.getDate());
      const monthLine = ws.getMonth() !== prevMonth ? plShortMonthLabel(ws.getMonth()) : '';
      const yearLine = ws.getFullYear() !== prevYear ? String(ws.getFullYear()) : '';
      initPoint(key, label3(day, monthLine, yearLine));
      prevMonth = ws.getMonth();
      prevYear = ws.getFullYear();
    }
  } else if (range === 'month') {
    // Last up to 10 months including current month, each bar = calendar month total.
    const MONTHS = 10;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const starts: Date[] = [];
    for (let i = MONTHS - 1; i >= 0; i -= 1) starts.push(addMonths(startMonth, -i));

    let prevYear = -1;
    for (const ms of starts) {
      const key = monthKey(ms);
      const month = plShortMonthLabel(ms.getMonth());
      const yearLine = ms.getFullYear() !== prevYear ? String(ms.getFullYear()) : '';
      initPoint(key, `${month}\n${yearLine}`);
      prevYear = ms.getFullYear();
    }
  } else if (range === 'quarter') {
    // Last up to 10 quarters including current quarter, each bar = calendar quarter total.
    const QUARTERS = 10;
    const thisQuarterStart = startOfQuarter(now);
    const starts: Date[] = [];
    for (let i = QUARTERS - 1; i >= 0; i -= 1) starts.push(addQuarters(thisQuarterStart, -i));

    let prevYear = -1;
    for (const qs of starts) {
      const key = quarterKey(qs);
      const month = plShortMonthLabel(qs.getMonth()); // first month of quarter
      const yearLine = qs.getFullYear() !== prevYear ? String(qs.getFullYear()) : '';
      initPoint(key, `${month}\n${yearLine}`);
      prevYear = qs.getFullYear();
    }
  } else {
    // Year: show up to last 10 years, each bar = calendar year total.
    const YEARS = 10;
    const current = now.getFullYear();
    for (let y = current - (YEARS - 1); y <= current; y += 1) {
      initPoint(String(y), String(y));
    }
  }

  for (const entry of source) {
    const ended = workoutEndedDate(entry);
    const value = sumSetsMetric(entry.sets, kind);
    if (value === 0) continue;

    if (range === 'week') {
      const thisWeekStart = isoWeekStartMonday(now);
      const windowStart = addDays(thisWeekStart, -7 * (10 - 1));
      const endedDay = startOfDay(ended);
      if (endedDay < windowStart) continue;
      const bucketStart = isoWeekStartMonday(endedDay);
      const key = weekKey(bucketStart);
      if (!points.has(key)) continue;
      points.set(key, (points.get(key) ?? 0) + value);
    } else if (range === 'month') {
      const key = monthKey(new Date(ended.getFullYear(), ended.getMonth(), 1));
      if (!points.has(key)) continue;
      points.set(key, (points.get(key) ?? 0) + value);
    } else if (range === 'quarter') {
      const key = quarterKey(startOfQuarter(ended));
      if (!points.has(key)) continue;
      points.set(key, (points.get(key) ?? 0) + value);
    } else {
      const key = yearKey(ended);
      if (!points.has(key)) continue;
      points.set(key, (points.get(key) ?? 0) + value);
    }
  }

  return Array.from(points.entries()).map(([key, value]) => ({
    key,
    label: labels.get(key) ?? key,
    value,
  }));
}

export function metricHintForKind(kind: ExerciseKind): string {
  switch (kind) {
    case 'weighted_reps':
      return 'Volume (kg)';
    case 'bodyweight_reps':
      return 'Reps';
    case 'time_based':
      return 'Time';
    case 'distance_per_time':
      return 'Distance (km)';
    default:
      return '';
  }
}

export function formatExerciseStatValue(kind: ExerciseKind, value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';

  switch (kind) {
    case 'weighted_reps': {
      const v = Math.round(value);
      if (v >= 10_000) return `${Math.round(v / 1000)}k`;
      return String(v);
    }
    case 'bodyweight_reps':
      return String(Math.round(value));
    case 'time_based':
      return formatDurationStat(value);
    case 'distance_per_time':
      return value >= 100 ? value.toFixed(0) : value.toFixed(1);
    default:
      return String(Math.round(value));
  }
}

function formatDurationStat(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
