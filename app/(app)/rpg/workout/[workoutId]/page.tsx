'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useWorkout, useWorkoutSets } from '@/hooks/useWorkout';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatSetText } from '@/lib/api-router';
import { exerciseKindTagClassName, getExerciseKindTitle, kindBuffBadgeClassName } from '@/lib/exercise-stats';
import { computeSetXp } from '@/lib/rpg/xp';
import { applyXpRates, applyKindRate } from '@/lib/rpg/buffs';
import type { ExerciseKind, XpRates } from '@/lib/types';

interface Props {
  params: Promise<{ workoutId: string }>;
}

const KIND_ORDER: ExerciseKind[] = [
  'weighted_reps',
  'bodyweight_reps',
  'time_based',
  'distance_per_time',
];

const DEFAULT_RATES: XpRates = {
  weighted_reps: 100,
  bodyweight_reps: 100,
  time_based: 100,
  distance_per_time: 100,
  total: 100,
};

function rateLabel(rate: number): string | null {
  if (rate === 100) return null;
  return `×${(rate / 100).toFixed(1)}`;
}

export default function RpgWorkoutPage({ params }: Props) {
  const { workoutId } = use(params);
  const { data: workout, isLoading: workoutLoading } = useWorkout(workoutId);
  const { data: sets = [], isLoading: setsLoading } = useWorkoutSets(workoutId);

  const xpRates = useMemo(
    () => (workout?.xp_rates ?? DEFAULT_RATES) as XpRates,
    [workout]
  );

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

  const baseTotal = useMemo(
    () => Object.values(kindTotals).reduce((sum, n) => sum + n, 0),
    [kindTotals]
  );

  const effectiveTotal = useMemo(
    () => applyXpRates(kindTotals, xpRates),
    [kindTotals, xpRates]
  );

  const hasBuff = useMemo(
    () => KIND_ORDER.some((k) => xpRates[k] !== 100) || xpRates.total !== 100,
    [xpRates]
  );

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
        <div className="mt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Total: {effectiveTotal} XP</span>
            {hasBuff && xpRates.total !== 100 && (
              <span className={kindBuffBadgeClassName('total')}>
                ×{(xpRates.total / 100).toFixed(1)} global
              </span>
            )}
          </div>
          {hasBuff && (
            <p className="mt-0.5 text-xs text-gray-400">Base: {baseTotal} XP</p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {KIND_ORDER.map((kind) => {
            const base = kindTotals[kind];
            const effective = applyKindRate(base, xpRates[kind]);
            const label = rateLabel(xpRates[kind]);
            return (
              <div key={kind} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <span className={exerciseKindTagClassName(kind)}>{getExerciseKindTitle(kind)}</span>
                {label ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900">{effective} XP</p>
                    <span className={kindBuffBadgeClassName(kind)}>
                      {label}
                    </span>
                    <p className="text-xs text-gray-400">base {base}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-gray-900">{base} XP</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-gray-900">All sets in this workout</h2>
        {sets.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No sets logged.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {sets.map((set) => {
              const baseXp = set.xp ?? computeSetXp(set.exercises.kind, set);
              const kindRate = xpRates[set.exercises.kind];
              // Per-set display: kind rate only (total rate applies at workout level, not per set)
              const effectiveXp = applyKindRate(baseXp, kindRate);
              const showBuff = kindRate !== 100;
              return (
                <li key={set.id} className="rounded-xl border border-gray-200/80 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{set.exercises.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={exerciseKindTagClassName(set.exercises.kind)}>
                          {getExerciseKindTitle(set.exercises.kind)}
                        </span>
                        <span className="basis-full text-xs text-gray-600">
                          {formatSetText(set, { kind: set.exercises.kind })}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        +{effectiveXp} XP
                      </span>
                      {showBuff && (
                        <span className="text-[10px] text-gray-400">
                          base {baseXp}
                        </span>
                      )}
                    </div>
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
