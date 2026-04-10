'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkout, useWorkoutSets, useDeleteWorkout } from '@/hooks/useWorkout';
import { useExercises } from '@/hooks/useExercises';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { generateWorkoutSummary, formatSetText } from '@/lib/api-router';
import { sortSetsOldestFirst } from '@/lib/sort-sets';
import type { Exercise, SetWithExercise } from '@/lib/types';

interface Props {
  params: Promise<{ workoutId: string }>;
}

export default function WorkoutSummaryPage({ params }: Props) {
  const { workoutId } = use(params);
  const router = useRouter();

  const { data: workout, isLoading: wLoading } = useWorkout(workoutId);
  const { data: sets = [], isLoading: sLoading } = useWorkoutSets(workoutId);
  const planId = workout?.plan_id ?? '';
  const { data: exercises = [], isLoading: eLoading } = useExercises(planId);
  const deleteWorkoutMut = useDeleteWorkout(planId);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const setGapById = useMemo(() => {
    if (!workout) return new Map<string, number>();
    const ordered = [...(sets as SetWithExercise[])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const map = new Map<string, number>();
    let previousMs = new Date(workout.started_at).getTime();
    for (const set of ordered) {
      const currentMs = new Date(set.created_at).getTime();
      const delta = Math.max(0, Math.round((currentMs - previousMs) / 1000));
      map.set(set.id, delta);
      previousMs = currentMs;
    }
    return map;
  }, [sets, workout]);

  async function handleDeleteWorkout() {
    if (!workoutId) return;
    setDeleteError('');
    try {
      await deleteWorkoutMut.mutateAsync(workoutId);
      setShowDeleteConfirm(false);
      router.push('/history');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete workout');
    }
  }

  if (wLoading || sLoading || (planId && eLoading)) return <PageSpinner />;
  if (!workout) return <div className="text-sm text-gray-500 p-4">Workout not found</div>;

  const summary = generateWorkoutSummary(workout, exercises, sets as Parameters<typeof generateWorkoutSummary>[2]);

  const start = new Date(workout.started_at);
  const end = workout.ended_at ? new Date(workout.ended_at) : new Date();
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(summary);
  }

  const loggedExercises = exercises.filter((ex) => sets.some((s) => s.exercise_id === ex.id));
  const totals = getKindTotals(loggedExercises, sets as SetWithExercise[]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/history" className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Workout Complete!</h1>
          <p className="text-sm text-gray-500">{dateStr}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{durationMin}</p>
          <p className="text-xs text-gray-500 mt-1">minutes</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{loggedExercises.length}</p>
          <p className="text-xs text-gray-500 mt-1">exercises</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{sets.length}</p>
          <p className="text-xs text-gray-500 mt-1">sets</p>
        </div>
      </div>

      {/* Kind totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Weighted reps</p>
          <p className="text-sm font-semibold text-gray-900">{totals.weightedVolumeKg.toFixed(0)} kg total volume</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Distance per time</p>
          <p className="text-sm font-semibold text-gray-900">
            {totals.distanceKm.toFixed(2)} km • {formatDuration(totals.distanceSeconds)} • {totals.avgSpeedKmh.toFixed(1)} km/h avg
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Time-based</p>
          <p className="text-sm font-semibold text-gray-900">{formatDuration(totals.timeBasedSeconds)} total</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Bodyweight reps</p>
          <p className="text-sm font-semibold text-gray-900">{totals.bodyweightReps} total reps</p>
        </div>
      </div>

      {/* Exercise breakdown */}
      <div className="flex flex-col gap-4 mb-6">
        {loggedExercises.map((ex) => {
          const exSets = sortSetsOldestFirst(sets.filter((s) => s.exercise_id === ex.id));
          return (
            <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{ex.name}</h3>
              <ul className="flex flex-col gap-1.5">
                {exSets.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 text-xs w-5 text-right">{i + 1}.</span>
                    <span>{formatSetText(s, ex)}</span>
                    {setGapById.has(s.id) && (
                      <span className="text-[11px] text-gray-400">
                        +{formatDuration(setGapById.get(s.id) ?? 0)} od poprzedniego wpisu
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-emerald-700">
                {getExerciseTotalLine(ex, exSets as SetWithExercise[])}
              </p>
            </div>
          );
        })}
      </div>

      {/* Raw summary */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Summary text</p>
          <button
            onClick={copyToClipboard}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy
          </button>
        </div>
        <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">{summary}</pre>
      </div>

      <div className="flex gap-3">
        <Link href="/history" className="flex-1">
          <Button variant="secondary" className="w-full">View history</Button>
        </Link>
        {planId && (
          <Link href={`/plans/${planId}`} className="flex-1">
            <Button className="w-full">Back to plan</Button>
          </Link>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <Button
          type="button"
          variant="danger"
          className="w-full"
          onClick={() => {
            setDeleteError('');
            setShowDeleteConfirm(true);
          }}
        >
          Delete workout
        </Button>
      </div>

      <Modal
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteError('');
        }}
        title="Delete this workout?"
      >
        <p className="mb-4 text-sm text-gray-600">
          This will permanently remove this workout and every set you logged in it. You can&apos;t undo this.
        </p>
        {deleteError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteError('');
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteWorkoutMut.isPending}
            onClick={handleDeleteWorkout}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getExerciseTotalLine(exercise: Exercise, exerciseSets: SetWithExercise[]): string {
  if (exercise.kind === 'weighted_reps') {
    const totalVolumeKg = exerciseSets.reduce((sum, s) => {
      if (s.value == null || s.reps == null) return sum;
      return sum + s.value * s.reps;
    }, 0);
    return `Total volume: ${totalVolumeKg.toFixed(0)} kg`;
  }

  if (exercise.kind === 'distance_per_time') {
    const totalDistanceKm = exerciseSets.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
    const totalSeconds = exerciseSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    const avgSpeed = totalSeconds > 0 ? (totalDistanceKm / totalSeconds) * 3600 : 0;
    return `Total distance: ${totalDistanceKm.toFixed(2)} km • Total time: ${formatDuration(totalSeconds)} • Avg speed: ${avgSpeed.toFixed(1)} km/h`;
  }

  if (exercise.kind === 'time_based') {
    const totalSeconds = exerciseSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    return `Total time: ${formatDuration(totalSeconds)}`;
  }

  const totalReps = exerciseSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  return `Total reps: ${totalReps}`;
}

function getKindTotals(exercises: Exercise[], allSets: SetWithExercise[]) {
  let weightedVolumeKg = 0;
  let distanceKm = 0;
  let distanceSeconds = 0;
  let timeBasedSeconds = 0;
  let bodyweightReps = 0;

  for (const exercise of exercises) {
    const exSets = allSets.filter((s) => s.exercise_id === exercise.id);
    if (exercise.kind === 'weighted_reps') {
      weightedVolumeKg += exSets.reduce((sum, s) => {
        if (s.value == null || s.reps == null) return sum;
        return sum + s.value * s.reps;
      }, 0);
    } else if (exercise.kind === 'distance_per_time') {
      distanceKm += exSets.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
      distanceSeconds += exSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    } else if (exercise.kind === 'time_based') {
      timeBasedSeconds += exSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    } else if (exercise.kind === 'bodyweight_reps') {
      bodyweightReps += exSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
    }
  }

  return {
    weightedVolumeKg,
    distanceKm,
    distanceSeconds,
    avgSpeedKmh: distanceSeconds > 0 ? (distanceKm / distanceSeconds) * 3600 : 0,
    timeBasedSeconds,
    bodyweightReps,
  };
}
