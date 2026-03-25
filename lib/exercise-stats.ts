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
  weighted_reps: 'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-200/80',
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
  month: number;
  year: number;
  all: number;
}

export function aggregateExerciseHistoryByPeriod(
  history: ExerciseHistoryEntry[] | undefined,
  kind: ExerciseKind,
  now = new Date()
): ExercisePeriodTotals {
  const monthSets: Set[] = [];
  const yearSets: Set[] = [];
  const allSets: Set[] = [];

  for (const entry of history ?? []) {
    const d = workoutEndedDate(entry);
    const sets = entry.sets;
    allSets.push(...sets);
    if (inCalendarYear(d, now)) {
      yearSets.push(...sets);
      if (inCalendarMonth(d, now)) monthSets.push(...sets);
    }
  }

  return {
    month: sumSetsMetric(monthSets, kind),
    year: sumSetsMetric(yearSets, kind),
    all: sumSetsMetric(allSets, kind),
  };
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
