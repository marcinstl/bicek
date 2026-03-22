'use client';

import { use, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useExercises } from '@/hooks/useExercises';
import { useWorkoutSets, useAddSet, useDeleteSet, useExerciseHistory } from '@/hooks/useWorkout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatSetText } from '@/lib/api-router';

interface Props {
  params: Promise<{ planId: string; exerciseId: string }>;
}

export default function ExercisePage({ params }: Props) {
  const { planId, exerciseId } = use(params);
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId') ?? '';
  const router = useRouter();

  const { data: exercises = [], isLoading: exLoading } = useExercises(planId);
  const { data: allSets = [], isLoading: setsLoading } = useWorkoutSets(workoutId);
  const { data: history = [], isLoading: histLoading } = useExerciseHistory(exerciseId, workoutId);
  const addSet = useAddSet(workoutId);
  const deleteSet = useDeleteSet(workoutId);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const currentSets = allSets.filter((s) => s.exercise_id === exerciseId);

  const [value, setValue] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const hasValue = exercise?.unit && value.trim();
    const hasReps = exercise?.metric_type === 'reps' && reps.trim();
    const isTimeSec = exercise?.metric_type === 'time' || exercise?.metric_type === 'time_sec';
    const isTimeMin = exercise?.metric_type === 'time_min';
    const hasTime = (isTimeSec || isTimeMin) && duration.trim();

    if (!hasValue && !hasReps && !hasTime) {
      setError('Enter at least one value');
      return;
    }

    const durationSeconds = hasTime
      ? isTimeMin
        ? Math.round(parseFloat(duration) * 60)
        : parseInt(duration)
      : null;

    await addSet.mutateAsync({
      workout_id: workoutId,
      exercise_id: exerciseId,
      value: hasValue ? parseFloat(value) : null,
      reps: hasReps ? parseInt(reps) : null,
      duration_seconds: durationSeconds,
      note: note.trim() || null,
    });

    setValue('');
    setReps('');
    setDuration('');
    setNote('');
  }

  if (exLoading || setsLoading) return <PageSpinner />;
  if (!exercise) {
    router.back();
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  function fmtDate(d: string) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/plans/${planId}/workout?workoutId=${workoutId}`}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{exercise.name}</h1>
          <div className="flex gap-2 mt-0.5">
            {exercise.unit && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg font-medium">
                {exercise.unit}
              </span>
            )}
            {exercise.metric_type && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg font-medium capitalize">
                {exercise.metric_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Current session ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          This session
        </h2>

        {/* Add set form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
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
              {(exercise.metric_type === 'time' || exercise.metric_type === 'time_sec') && (
                <Input
                  label="Duration (sec)"
                  type="number"
                  inputMode="numeric"
                  placeholder="60"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              )}
              {exercise.metric_type === 'time_min' && (
                <Input
                  label="Duration (min)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="5"
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

            <Button type="submit" loading={addSet.isPending} className="w-full">
              + Add set
            </Button>
          </form>
        </div>

        {/* Current sets list */}
        {currentSets.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {currentSets.map((s, i) => (
              <li
                key={s.id}
                className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400 w-5 text-right">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {formatSetText(s, exercise)}
                  </span>
                </div>
                <button
                  onClick={() => deleteSet.mutate(s.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No sets logged yet</p>
        )}
      </section>

      {/* ─── Previous sessions ─── */}
      {!histLoading && history.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Previous sessions
          </h2>

          <ul className="flex flex-col gap-3">
            {history.map(({ workout, sets }) => (
              <li key={workout.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-400 mb-2">
                  {fmtDate(workout.started_at)}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {sets.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="text-xs text-gray-300 w-5 text-right">{i + 1}.</span>
                      {formatSetText(s, exercise)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
