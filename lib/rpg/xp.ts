import type { ExerciseKind } from '@/lib/types';

interface XpSetInput {
  value: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
}

function safe(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function roundDown(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Czas (min) jako główna baza XP; dystans słabszy — tempo nie wchodzi osobno. */
export const DISTANCE_PER_TIME_TIME_WEIGHT = 72;
export const DISTANCE_PER_TIME_DISTANCE_WEIGHT = 12;

export function computeSetXp(kind: ExerciseKind, set: XpSetInput): number {
  const reps = safe(set.reps);
  const kg = safe(set.value);
  const seconds = safe(set.duration_seconds);
  const distanceKm = safe(set.distance_km);

  switch (kind) {
    case 'weighted_reps':
      return roundDown((reps * kg) / 10);
    case 'bodyweight_reps':
      return roundDown(35 * Math.sqrt(reps));
    case 'time_based': {
      const minutes = seconds / 60;
      return roundDown(60 * Math.sqrt(minutes));
    }
    case 'distance_per_time': {
      if (seconds <= 0 || distanceKm <= 0) return 0;
      const minutes = seconds / 60;
      return roundDown(
        DISTANCE_PER_TIME_TIME_WEIGHT * Math.sqrt(minutes) +
          DISTANCE_PER_TIME_DISTANCE_WEIGHT * Math.sqrt(distanceKm),
      );
    }
    default:
      return 0;
  }
}
