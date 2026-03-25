'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useExercises } from '@/hooks/useExercises';
import { useExerciseHistoryAll } from '@/hooks/useWorkout';
import {
  aggregateExerciseHistoryByPeriod,
  exerciseKindTagClassName,
  formatExerciseStatValue,
  getExerciseKindTitle,
  metricHintForKind,
  resolveExerciseKind,
} from '@/lib/exercise-stats';
import { PageSpinner } from '@/components/ui/Spinner';
import { ExerciseHistoryBarChart } from '@/components/charts/ExerciseHistoryBarChart';

interface Props {
  params: Promise<{ planId: string; exerciseId: string }>;
}

export default function ExerciseStatsPage({ params }: Props) {
  const { planId, exerciseId } = use(params);
  const { data: exercises = [], isLoading: exLoading } = useExercises(planId);
  const { data: history, isLoading: histLoading } = useExerciseHistoryAll(exerciseId);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const kind = exercise ? resolveExerciseKind(exercise) : 'bodyweight_reps';

  const totals = useMemo(
    () => aggregateExerciseHistoryByPeriod(history, kind),
    [history, kind]
  );

  const statCells = useMemo(
    () => [
      { key: 'Month' as const, raw: totals.month },
      { key: 'Year' as const, raw: totals.year },
      { key: 'All time' as const, raw: totals.all },
    ],
    [totals]
  );

  if (exLoading) return <PageSpinner />;
  if (!exercise) {
    return (
      <div className="p-4 text-sm text-gray-600">
        Exercise not found.{' '}
        <Link href={`/plans/${planId}`} className="font-medium text-emerald-600 hover:underline">
          Back to plan
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 border-b border-gray-100 pb-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={`/plans/${planId}`}
            className="-ml-2 shrink-0 rounded-xl p-2 transition-colors hover:bg-gray-100"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900">{exercise.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className={exerciseKindTagClassName(kind)}>{getExerciseKindTitle(kind)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {metricHintForKind(kind)}
          </p>
          <div className="flex w-full items-stretch justify-between gap-2 sm:gap-3">
          {statCells.map(({ key, raw }) => (
            <div
              key={key}
              className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 text-center"
            >
              <p
                className={`text-center text-lg font-bold tabular-nums leading-none ${
                  histLoading && history === undefined ? 'text-gray-400' : 'text-gray-900'
                }`}
              >
                {histLoading && history === undefined ? '—' : formatExerciseStatValue(kind, raw)}
              </p>
              <p className="text-[10px] leading-tight text-gray-500 sm:text-xs">{key}</p>
            </div>
          ))}
          </div>
        </div>
      </div>

      <ExerciseHistoryBarChart history={history} kind={kind} />
    </div>
  );
}
