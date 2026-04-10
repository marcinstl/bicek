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
import {
  exerciseKindTagClassName,
  getExerciseKindTitle,
  resolveExerciseKind,
} from '@/lib/exercise-stats';
import { sortSetsOldestFirst } from '@/lib/sort-sets';

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
  const currentSets = sortSetsOldestFirst(allSets.filter((s) => s.exercise_id === exerciseId));

  const [value, setValue] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [reps, setReps] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!exercise) return;

    const kind = resolveExerciseKind(exercise);
    const hasWeighted = kind === 'weighted_reps' && value.trim() && reps.trim();
    const hasBodyweight = kind === 'bodyweight_reps' && reps.trim();
    const hasTime = kind === 'time_based' && durationSeconds && durationSeconds > 0;
    const hasDistancePerTime =
      kind === 'distance_per_time' && distanceKm.trim() && durationSeconds && durationSeconds > 0;

    if (!hasWeighted && !hasBodyweight && !hasTime && !hasDistancePerTime) {
      setError('Complete required fields for this set type');
      return;
    }

    await addSet.mutateAsync({
      workout_id: workoutId,
      exercise_id: exerciseId,
      value: hasWeighted ? parseFloat(value) : null,
      reps: hasWeighted || hasBodyweight ? parseInt(reps) : null,
      distance_km: hasDistancePerTime ? parseFloat(distanceKm) : null,
      duration_seconds: hasTime || hasDistancePerTime ? durationSeconds : null,
      note: note.trim() || null,
    });

    setValue('');
    setDistanceKm('');
    setReps('');
    setDurationSeconds(null);
    setNote('');
  }

  if (exLoading || setsLoading) return <PageSpinner />;
  if (!exercise) {
    router.back();
    return null;
  }

  const exerciseKind = resolveExerciseKind(exercise);

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
          <div className="mt-0.5 flex flex-wrap gap-2">
            <span className={exerciseKindTagClassName(exerciseKind)}>{getExerciseKindTitle(exerciseKind)}</span>
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
              {exerciseKind === 'weighted_reps' && (
                <Input
                  label="Weight (kg)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              {(exerciseKind === 'weighted_reps' || exerciseKind === 'bodyweight_reps') && (
                <Input
                  label="Reps"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              )}
              {exerciseKind === 'distance_per_time' && (
                <Input
                  label="Distance (km)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="1.5"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                />
              )}
              {(exerciseKind === 'time_based' || exerciseKind === 'distance_per_time') && (
                <DurationKeypadInput
                  label="Time"
                  seconds={durationSeconds}
                  onChangeSeconds={setDurationSeconds}
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

function DurationKeypadInput({
  label,
  seconds,
  onChangeSeconds,
}: {
  label: string;
  seconds: number | null;
  onChangeSeconds: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rawDigits, setRawDigits] = useState(() => secondsToRawDigits(seconds ?? 0));

  function openPicker() {
    setRawDigits(secondsToRawDigits(seconds ?? 0));
    setOpen(true);
  }

  function pushDigit(digit: string) {
    setRawDigits((prev) => `${prev}${digit}`.replace(/\D/g, '').slice(-6));
  }

  function backspace() {
    setRawDigits((prev) => prev.slice(0, -1));
  }

  function save() {
    onChangeSeconds(rawDigitsToSeconds(rawDigits));
    setOpen(false);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={openPicker}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {formatHHMMSS(seconds ?? 0)}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-medium text-gray-500 mb-2">{label}</p>
            <p className="text-4xl font-semibold tracking-wider text-center text-gray-900 mb-4">
              {formatHHMMSS(rawDigitsToSeconds(rawDigits))}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => pushDigit(digit)}
                  className={digit === '0'
                    ? 'col-start-2 rounded-xl border border-gray-300 py-3 text-lg font-semibold text-gray-800 hover:border-emerald-400 transition-colors'
                    : 'rounded-xl border border-gray-300 py-3 text-lg font-semibold text-gray-800 hover:border-emerald-400 transition-colors'}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={backspace}
                className="rounded-xl border border-gray-300 py-3 text-lg font-semibold text-gray-800 hover:border-emerald-400 transition-colors"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function secondsToRawDigits(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  return `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`.replace(/^0+/, '');
}

function rawDigitsToSeconds(rawDigits: string): number {
  const padded = rawDigits.replace(/\D/g, '').slice(-6).padStart(6, '0');
  const hh = parseInt(padded.slice(0, 2), 10);
  const mm = parseInt(padded.slice(2, 4), 10);
  const ss = parseInt(padded.slice(4, 6), 10);
  return hh * 3600 + mm * 60 + ss;
}

function formatHHMMSS(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
