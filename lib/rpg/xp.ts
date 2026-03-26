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
      const avgSpeedKmh = distanceKm / (seconds / 3600);
      return roundDown(10 * Math.sqrt(distanceKm * avgSpeedKmh));
    }
    default:
      return 0;
  }
}
