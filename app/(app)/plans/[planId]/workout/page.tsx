'use client';

import { use, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkout, useWorkoutSets, useFinishWorkout } from '@/hooks/useWorkout';
import { useExercises } from '@/hooks/useExercises';
import { useWorkoutTimer, formatDuration } from '@/components/providers/WorkoutTimerContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import type { SetWithExercise } from '@/lib/types';
import { exerciseKindTagClassName, getExerciseKindTitle } from '@/lib/exercise-stats';

interface Props {
  params: Promise<{ planId: string }>;
}

export default function WorkoutPage({ params }: Props) {
  const { planId } = use(params);
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId') ?? '';
  const router = useRouter();

  const { data: workout, isLoading: workoutLoading } = useWorkout(workoutId);
  const { data: sets = [] } = useWorkoutSets(workoutId);
  const { data: exercises = [] } = useExercises(planId);
  const finishWorkout = useFinishWorkout(planId);

  const [showFinish, setShowFinish] = useState(false);

  const { elapsed, invalidateActiveWorkout } = useWorkoutTimer();

  const handleFinish = useCallback(async () => {
    await finishWorkout.mutateAsync(workoutId);
    invalidateActiveWorkout();
    router.push(`/history/${workoutId}`);
  }, [finishWorkout, workoutId, planId, router, invalidateActiveWorkout]);

  if (workoutLoading || !workout) return <PageSpinner />;

  const setsByExercise = exercises.reduce<Record<string, SetWithExercise[]>>((acc, ex) => {
    acc[ex.id] = sets.filter((s) => s.exercise_id === ex.id);
    return acc;
  }, {});

  const completedExerciseIds = exercises
    .filter((ex) => (setsByExercise[ex.id]?.length ?? 0) > 0)
    .map((ex) => ex.id);

  const pendingExercises = exercises.filter((ex) => !completedExerciseIds.includes(ex.id));
  const completedExercises = exercises.filter((ex) => completedExerciseIds.includes(ex.id));

  function goToExercise(exerciseId: string) {
    router.push(`/plans/${planId}/workout/exercise/${exerciseId}?workoutId=${workoutId}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/plans/${planId}`} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Active Workout</h1>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowFinish(true)}>
          Finish
        </Button>
      </div>

      {/* Pending exercises */}
      {pendingExercises.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Exercises</h2>
          <ul className="flex flex-col gap-2">
            {pendingExercises.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => goToExercise(ex.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate font-semibold text-gray-900">{ex.name}</p>
                    <span className={exerciseKindTagClassName(ex.kind)}>{getExerciseKindTitle(ex.kind)}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Completed exercises */}
      {completedExercises.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Logged</h2>
          <ul className="flex flex-col gap-2">
            {completedExercises.map((ex) => {
              const exSets = setsByExercise[ex.id] ?? [];
              return (
                <li key={ex.id}>
                  <button
                    onClick={() => goToExercise(ex.id)}
                    className="w-full bg-green-50 rounded-2xl border border-green-100 px-4 py-3.5 flex items-center gap-3 hover:border-green-300 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ex.name}</p>
                      <p className="text-xs text-gray-500">
                        {exSets.length} set{exSets.length !== 1 ? 's' : ''} logged
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Finish confirmation */}
      <Modal open={showFinish} onClose={() => setShowFinish(false)} title="Finish workout?">
        <p className="text-sm text-gray-600 mb-6">
          This will end your workout and generate a summary. Duration:{' '}
          <strong>{formatDuration(elapsed)}</strong>
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowFinish(false)}>Continue</Button>
          <Button loading={finishWorkout.isPending} onClick={handleFinish}>Finish workout</Button>
        </div>
      </Modal>
    </div>
  );
}
