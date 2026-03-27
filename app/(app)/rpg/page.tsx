'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useSetsForWorkouts, useWorkoutHistory } from '@/hooks/useWorkout';
import { getLevelProgress } from '@/lib/rpg/leveling';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind } from '@/lib/types';

type RpgEvent = {
  key: string;
  timestamp: string;
  workoutTimeMs: number;
  title: string;
  details: string;
  levelUpLabel: string | null;
};

const KIND_ORDER: ExerciseKind[] = [
  'weighted_reps',
  'bodyweight_reps',
  'time_based',
  'distance_per_time',
];

const PIXEL_ART_ICONS = [
  'Iicon_32_01.png',
  'Iicon_32_02.png',
  'Iicon_32_03.png',
  'Iicon_32_04.png',
  'Iicon_32_05.png',
  'Iicon_32_06.png',
  'Iicon_32_07.png',
  'Iicon_32_08.png',
  'Iicon_32_09.png',
  'Iicon_32_10.png',
  'Iicon_32_11.png',
  'Iicon_32_12.png',
  'Iicon_32_13.png',
  'Iicon_32_14.png',
  'Iicon_32_15.png',
  'Iicon_32_16.png',
  'Iicon_32_17.png',
  'Iicon_32_18.png',
  'Iicon_32_19.png',
  'Iicon_32_20.png',
  'Iicon_32_21.png',
  'Iicon_32_22.png',
  'Iicon_32_23.png',
  'Iicon_32_24.png',
  'Iicon_32_25.png',
  'Iicon_32_26.png',
  'Iicon_32_27.png',
  'Iicon_32_28.png',
  'Iicon_32_29.png',
  'Iicon_32_30.png',
  'Iicon_32_31.png',
  'Iicon_32_32.png',
  'Iicon_32_33.png',
  'Iicon_32_34.png',
  'Iicon_32_35.png',
  'Iicon_32_36.png',
  'Iicon_32_37.png',
  'Iicon_32_38.png',
  'Iicon_32_39.png',
  'Iicon_32_40.png',
];

function kindLabel(kind: ExerciseKind): string {
  switch (kind) {
    case 'weighted_reps':
      return 'weighted reps';
    case 'bodyweight_reps':
      return 'bodyweight reps';
    case 'time_based':
      return 'time based';
    case 'distance_per_time':
      return 'distance per time';
    default:
      return kind;
  }
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RpgPage() {
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory();
  const workoutIds = useMemo(() => history.map((w) => w.id), [history]);
  const { data: sets = [], isLoading: setsLoading } = useSetsForWorkouts(workoutIds, workoutIds.length > 0);

  const totalXp = useMemo(() => {
    return sets.reduce((sum, set) => {
      if (set.xp != null) return sum + set.xp;
      return sum + computeSetXp(set.exercises.kind, set);
    }, 0);
  }, [sets]);

  const progress = getLevelProgress(totalXp);
  const loading = historyLoading || (workoutIds.length > 0 && setsLoading);
  const events = useMemo<RpgEvent[]>(() => {
    if (loading) return [];

    const setsByWorkout = new Map<string, typeof sets>();
    for (const set of sets) {
      const arr = setsByWorkout.get(set.workout_id);
      if (arr) arr.push(set);
      else setsByWorkout.set(set.workout_id, [set]);
    }

    const ordered = [...history].sort((a, b) => {
      const aMs = new Date(a.ended_at ?? a.started_at).getTime();
      const bMs = new Date(b.ended_at ?? b.started_at).getTime();
      return bMs - aMs;
    });
    const workoutEvents: RpgEvent[] = [];
    let cumulativeXp = totalXp;

    for (const workout of ordered) {
      const afterLevel = getLevelProgress(cumulativeXp).level;
      const workoutSets = setsByWorkout.get(workout.id) ?? [];
      const byKind: Record<ExerciseKind, number> = {
        weighted_reps: 0,
        bodyweight_reps: 0,
        time_based: 0,
        distance_per_time: 0,
      };

      for (const set of workoutSets) {
        const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
        byKind[set.exercises.kind] += xp;
      }

      const workoutXp = Object.values(byKind).reduce((sum, n) => sum + n, 0);
      cumulativeXp -= workoutXp;
      const beforeLevel = getLevelProgress(Math.max(0, cumulativeXp)).level;

      const breakdown = KIND_ORDER
        .filter((kind) => byKind[kind] > 0)
        .map((kind) => `${kindLabel(kind)}: ${byKind[kind]} XP`)
        .join(' • ');

      const workoutTimestamp = workout.ended_at ?? workout.started_at;
      const workoutTimeMs = new Date(workoutTimestamp).getTime();

      const levelUpLabel = afterLevel > beforeLevel ? `Level Up ${beforeLevel} > ${afterLevel}` : null;

      workoutEvents.push({
        key: `workout-${workout.id}`,
        timestamp: workoutTimestamp,
        workoutTimeMs,
        title: `Workout completed (+${workoutXp} XP)`,
        details: breakdown || 'No XP breakdown available',
        levelUpLabel,
      });
    }

    return workoutEvents
      .sort((a, b) => {
        if (b.workoutTimeMs !== a.workoutTimeMs) return b.workoutTimeMs - a.workoutTimeMs;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 10);
  }, [history, loading, sets, totalXp]);

  return (
    <div className="relative pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RPG & Gamification</h1>
      </div>
      
      <div className="rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Poziom {progress.level}</h2>
        <div className="w-full max-w-xs mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progress.currentLevelXp} XP</span>
            <span>{progress.nextLevelXp} XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress.progressPct}%` }} />
          </div>
          <div className="mt-3 text-left">
            {loading ? (
              <p className="text-xs text-gray-400">Liczenie XP...</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">Total: {progress.totalXp} XP</p>
                <p className="text-xs text-gray-400 mt-1">Potrzebny XP: {progress.xpToNextLevel}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Ostatnie 10 workoutów</h3>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">Ładowanie logu...</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Brak workoutów jeszcze.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((event) => (
              <li
                key={event.key}
                className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{event.details}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{formatEventDate(event.timestamp)}</p>
                </div>
                <div className="shrink-0">
                  {event.levelUpLabel ? (
                    <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      {event.levelUpLabel}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-400">
                      -
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Pixel Art Items</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {PIXEL_ART_ICONS.map((fileName) => (
            <div
              key={fileName}
              className="flex h-14 w-14 items-center justify-center rounded-md border border-gray-300 bg-gray-50"
              title={fileName}
            >
              <Image
                src={`/pixelart/${fileName}`}
                alt={fileName}
                width={48}
                height={48}
                className="h-12 w-12 pixel-art"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
