'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useWorkout, useWorkoutSets } from '@/hooks/useWorkout';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatSetText } from '@/lib/api-router';
import { exerciseKindTagClassName, getExerciseKindTitle } from '@/lib/exercise-stats';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind } from '@/lib/types';

interface Props {
  params: Promise<{ workoutId: string }>;
}

const KIND_ORDER: ExerciseKind[] = [
  'weighted_reps',
  'bodyweight_reps',
  'time_based',
  'distance_per_time',
];

export default function RpgWorkoutPage({ params }: Props) {
  const { workoutId } = use(params);
  const { data: workout, isLoading: workoutLoading } = useWorkout(workoutId);
  const { data: sets = [], isLoading: setsLoading } = useWorkoutSets(workoutId);

  const kindTotals = useMemo(() => {
    const totals: Record<ExerciseKind, number> = {
      weighted_reps: 0,
      bodyweight_reps: 0,
      time_based: 0,
      distance_per_time: 0,
    };
    for (const set of sets) {
      const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
      totals[set.exercises.kind] += xp;
    }
    return totals;
  }, [sets]);

  const totalXp = useMemo(() => Object.values(kindTotals).reduce((sum, n) => sum + n, 0), [kindTotals]);

  if (workoutLoading || setsLoading) return <PageSpinner />;
  if (!workout) return <div className="text-sm text-gray-500 p-4">Workout not found</div>;

  const endedAt = workout.ended_at ?? workout.started_at;
  const date = new Date(endedAt);
  const dateLabel = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative pb-28">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/rpg" className="-ml-2 rounded-xl p-2 transition-colors hover:bg-gray-100">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900">RPG Workout Log</h1>
            <p className="text-sm text-gray-500">{dateLabel} · {timeLabel}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-gray-900">XP by category</h2>
        <p className="mt-1 text-xs text-gray-500">Total: {totalXp} XP</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {KIND_ORDER.map((kind) => (
            <div key={kind} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className={exerciseKindTagClassName(kind)}>{getExerciseKindTitle(kind)}</span>
              <p className="mt-1 text-sm font-semibold text-gray-900">{kindTotals[kind]} XP</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-gray-900">All sets in this workout</h2>
        {sets.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No sets logged.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {sets.map((set) => {
              const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
              return (
                <li key={set.id} className="rounded-xl border border-gray-200/80 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{set.exercises.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={exerciseKindTagClassName(set.exercises.kind)}>
                          {getExerciseKindTitle(set.exercises.kind)}
                        </span>
                        <span className="text-xs text-gray-600">
                          {formatSetText(set, { kind: set.exercises.kind })}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      +{xp} XP
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
