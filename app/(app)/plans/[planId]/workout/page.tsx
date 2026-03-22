'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkout, useWorkoutSets, useFinishWorkout, useAddSet, useDeleteSet } from '@/hooks/useWorkout';
import { useExercises } from '@/hooks/useExercises';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatSetText } from '@/lib/api';
import type { Exercise, SetWithExercise } from '@/lib/types';

interface Props {
  params: Promise<{ planId: string }>;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const addSet = useAddSet(workoutId);
  const deleteSet = useDeleteSet(workoutId);

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (!workout?.started_at) return;
    const start = new Date(workout.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [workout?.started_at]);

  const handleFinish = useCallback(async () => {
    await finishWorkout.mutateAsync(workoutId);
    router.push(`/plans/${planId}/workout/summary?workoutId=${workoutId}`);
  }, [finishWorkout, workoutId, planId, router]);

  if (workoutLoading || !workout) return <PageSpinner />;

  // Group sets by exercise
  const setsByExercise = exercises.reduce<Record<string, SetWithExercise[]>>((acc, ex) => {
    acc[ex.id] = sets.filter((s) => s.exercise_id === ex.id);
    return acc;
  }, {});

  const completedExerciseIds = exercises
    .filter((ex) => (setsByExercise[ex.id]?.length ?? 0) > 0)
    .map((ex) => ex.id);

  const pendingExercises = exercises.filter((ex) => !completedExerciseIds.includes(ex.id));
  const completedExercises = exercises.filter((ex) => completedExerciseIds.includes(ex.id));

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
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-mono text-gray-600">{formatDuration(elapsed)}</span>
          </div>
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
                  onClick={() => setSelectedExercise(ex)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{ex.name}</p>
                    <p className="text-xs text-gray-400">
                      {[ex.unit, ex.metric_type].filter(Boolean).join(' · ')}
                    </p>
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
                    onClick={() => setSelectedExercise(ex)}
                    className="w-full bg-green-50 rounded-2xl border border-green-100 px-4 py-3.5 flex items-center gap-3 hover:border-green-300 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ex.name}</p>
                      <p className="text-xs text-gray-500">{exSets.length} set{exSets.length !== 1 ? 's' : ''} logged</p>
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

      {/* Log set modal */}
      {selectedExercise && (
        <LogSetModal
          workoutId={workoutId}
          exercise={selectedExercise}
          sets={setsByExercise[selectedExercise.id] ?? []}
          onClose={() => setSelectedExercise(null)}
          addSet={addSet}
          deleteSet={deleteSet}
        />
      )}

      {/* Finish confirmation */}
      <Modal open={showFinish} onClose={() => setShowFinish(false)} title="Finish workout?">
        <p className="text-sm text-gray-600 mb-6">
          This will end your workout and generate a summary. Duration: <strong>{formatDuration(elapsed)}</strong>
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowFinish(false)}>Continue</Button>
          <Button loading={finishWorkout.isPending} onClick={handleFinish}>Finish workout</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Log Set Modal ────────────────────────────────────────────────────────────

interface LogSetModalProps {
  workoutId: string;
  exercise: Exercise;
  sets: SetWithExercise[];
  onClose: () => void;
  addSet: ReturnType<typeof useAddSet>;
  deleteSet: ReturnType<typeof useDeleteSet>;
}

function LogSetModal({ workoutId, exercise, sets, onClose, addSet, deleteSet }: LogSetModalProps) {
  const [value, setValue] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const hasValue = exercise.unit && value.trim();
    const hasReps = exercise.metric_type === 'reps' && reps.trim();
    const hasTime = exercise.metric_type === 'time' && duration.trim();

    if (!hasValue && !hasReps && !hasTime) {
      setError('Enter at least one value');
      return;
    }

    await addSet.mutateAsync({
      workout_id: workoutId,
      exercise_id: exercise.id,
      value: hasValue ? parseFloat(value) : null,
      reps: hasReps ? parseInt(reps) : null,
      duration_seconds: hasTime ? parseInt(duration) : null,
      note: note.trim() || null,
    });

    setValue('');
    setReps('');
    setDuration('');
    setNote('');
  }

  return (
    <Modal open onClose={onClose} title={exercise.name}>
      {/* Existing sets */}
      {sets.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {sets.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-sm text-gray-700">
                <span className="text-gray-400 text-xs mr-2">#{i + 1}</span>
                {formatSetText(s, exercise)}
              </span>
              <button
                onClick={() => deleteSet.mutate(s.id)}
                className="p-1 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {exercise.unit && (
            <Input
              label={`Value (${exercise.unit})`}
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
          {exercise.metric_type === 'reps' && (
            <Input
              label="Reps"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          )}
          {exercise.metric_type === 'time' && (
            <Input
              label="Duration (seconds)"
              type="number"
              inputMode="numeric"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          )}
        </div>

        <Input
          label="Note (optional)"
          placeholder="Any notes..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button type="submit" loading={addSet.isPending} className="w-full mt-1">
          + Log set
        </Button>
      </form>
    </Modal>
  );
}
