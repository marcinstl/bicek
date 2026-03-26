'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlans } from '@/hooks/usePlans';
import { useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise } from '@/hooks/useExercises';
import { useActiveWorkout, useStartWorkout, useWorkoutHistory } from '@/hooks/useWorkout';
import { useWorkoutTimer } from '@/components/providers/WorkoutTimerContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Exercise, ExerciseKind } from '@/lib/types';
import { exerciseKindTagClassName, getExerciseKindTitle } from '@/lib/exercise-stats';

interface Props {
  params: Promise<{ planId: string }>;
}

export default function PlanDetailPage({ params }: Props) {
  const { planId } = use(params);
  const router = useRouter();
  const { data: plans } = usePlans();
  const { data: exercises, isLoading } = useExercises(planId);
  const { data: workoutHistory, isLoading: historyLoading } = useWorkoutHistory();
  const { data: activeWorkout } = useActiveWorkout(planId);
  const { activeWorkoutId } = useWorkoutTimer();
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise(planId);
  const deleteExercise = useDeleteExercise(planId);
  const startWorkout = useStartWorkout();

  // Another workout (on a different plan) is in progress
  const otherWorkoutActive = activeWorkoutId && activeWorkoutId !== activeWorkout?.id;

  const plan = plans?.find((p) => p.id === planId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyForm = { name: '', kind: 'weighted_reps' as ExerciseKind };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [startCountdownOpen, setStartCountdownOpen] = useState(false);
  const [startCountdownSec, setStartCountdownSec] = useState(5);
  const [startCountdownError, setStartCountdownError] = useState('');
  const startCountdownAbortRef = useRef(false);
  const startWorkoutMutateRef = useRef(startWorkout.mutateAsync);
  startWorkoutMutateRef.current = startWorkout.mutateAsync;
  const routerRef = useRef(router);
  routerRef.current = router;

  function openAddExercise() {
    setForm(emptyForm);
    setFormError('');
    setShowCreate(true);
    setFabOpen(false);
  }

  useEffect(() => {
    if (!fabOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFabOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fabOpen]);

  function abortStartWorkoutCountdown() {
    startCountdownAbortRef.current = true;
    setStartCountdownOpen(false);
    setStartCountdownSec(5);
    setStartCountdownError('');
  }

  useEffect(() => {
    if (!startCountdownOpen) return;

    startCountdownAbortRef.current = false;
    setStartCountdownError('');
    setStartCountdownSec(5);
    let remaining = 5;

    const id = window.setInterval(() => {
      remaining -= 1;
      setStartCountdownSec(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        if (startCountdownAbortRef.current) return;
        void (async () => {
          try {
            const workout = await startWorkoutMutateRef.current(planId);
            setStartCountdownOpen(false);
            setStartCountdownSec(5);
            routerRef.current.push(`/plans/${planId}/workout?workoutId=${workout.id}`);
          } catch (err) {
            setStartCountdownError(
              err instanceof Error ? err.message : 'Failed to start workout'
            );
          }
        })();
      }
    }, 1000);

    return () => {
      startCountdownAbortRef.current = true;
      window.clearInterval(id);
    };
  }, [startCountdownOpen, planId]);

  function validateForm(f: typeof form) {
    if (!f.name.trim()) return 'Name is required';
    return '';
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    await createExercise.mutateAsync({
      plan_id: planId,
      name: form.name.trim(),
      kind: form.kind,
    });
    setForm(emptyForm);
    setFormError('');
    setShowCreate(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    if (!editingExercise) return;
    await updateExercise.mutateAsync({
      id: editingExercise.id,
      input: {
        name: form.name.trim(),
        kind: form.kind,
      },
    });
    setEditingExercise(null);
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deleteExercise.mutateAsync(deletingId);
    setDeletingId(null);
  }

  async function handleStartWorkout() {
    if (activeWorkout) {
      router.push(`/plans/${planId}/workout?workoutId=${activeWorkout.id}`);
      return;
    }
    const workout = await startWorkout.mutateAsync(planId);
    router.push(`/plans/${planId}/workout?workoutId=${workout.id}`);
  }

  function toExerciseKind(ex: Exercise): ExerciseKind {
    if (ex.kind) return ex.kind;
    if (ex.metric_type === 'reps' && ex.unit) return 'weighted_reps';
    if (ex.metric_type === 'reps') return 'bodyweight_reps';
    if (ex.metric_type === 'time' || ex.metric_type === 'time_sec' || ex.metric_type === 'time_min') {
      return 'time_based';
    }
    return 'bodyweight_reps';
  }

  function openEdit(ex: Exercise) {
    setEditingExercise(ex);
    setForm({
      name: ex.name,
      kind: toExerciseKind(ex),
    });
    setFormError('');
  }

  const workoutStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = todayStart.getDay(); // 0=Sun..6=Sat
    const shift = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + shift);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    const y = now.getFullYear();
    const m = now.getMonth();
    let week = 0;
    let month = 0;
    let year = 0;
    let total = 0;
    for (const w of workoutHistory ?? []) {
      if (w.plan_id !== planId || !w.ended_at) continue;
      total += 1;
      const d = new Date(w.ended_at);
      if (d >= weekStart && d < weekEnd) week += 1;
      if (d.getFullYear() === y) {
        year += 1;
        if (d.getMonth() === m) month += 1;
      }
    }
    return { week, month, year, total };
  }, [workoutHistory, planId]);

  const workoutFabDisabled =
    otherWorkoutActive || startWorkout.isPending || (!activeWorkout && !exercises?.length);

  return (
    <div className="relative pb-28">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link href="/plans" className="-ml-2 shrink-0 rounded-xl p-2 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900">{plan?.name ?? 'Plan'}</h1>
            <p className="text-sm text-gray-500">{exercises?.length ?? 0} exercises</p>
          </div>
        </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Workouts
          </p>
          <div className="flex w-full items-stretch justify-between gap-2 sm:gap-3">
          {(
            [
              { value: workoutStats.week, label: 'Week' },
              { value: workoutStats.month, label: 'Month' },
              { value: workoutStats.year, label: 'Year' },
              { value: workoutStats.total, label: 'All time' },
            ] as const
          ).map(({ value, label }) => (
            <div key={label} className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 text-center">
              <p
                className={`text-lg font-bold tabular-nums leading-none ${
                  historyLoading && workoutHistory === undefined ? 'text-gray-400' : 'text-gray-900'
                }`}
              >
                {historyLoading && workoutHistory === undefined ? '—' : value}
              </p>
              <p className="text-[10px] leading-tight text-gray-500 sm:text-xs">{label}</p>
            </div>
          ))}
          </div>
        </div>
      </div>

      {otherWorkoutActive && (
        <div className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-gray-100 px-3 py-3 text-sm text-gray-500">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Another workout is already in progress
        </div>
      )}

      {activeWorkout && !otherWorkoutActive && (
        <div className="mb-5 rounded-2xl border border-emerald-200/90 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-600/10 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] animate-pulse" />
            <p className="text-sm font-semibold text-emerald-900">Workout in progress</p>
          </div>
          <p className="mb-3 text-xs text-emerald-800/80">Continue logging sets on this plan.</p>
          <Button type="button" className="w-full" onClick={() => void handleStartWorkout()}>
            Resume workout
          </Button>
        </div>
      )}

      {isLoading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li
              key={`exercise-skeleton-${idx}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 animate-pulse"
            >
              <div className="flex-1 min-w-0">
                <div className="h-4 w-40 rounded bg-gray-200 mb-2" />
                <div className="h-5 w-28 rounded bg-gray-100" />
              </div>
              <div className="flex items-center gap-1">
                <div className="h-8 w-8 rounded-xl bg-gray-100" />
                <div className="h-8 w-8 rounded-xl bg-gray-100" />
              </div>
            </li>
          ))}
        </ul>
      ) : exercises?.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No exercises yet"
          description="Add your first exercise to this plan."
          action={<Button onClick={openAddExercise}>Add exercise</Button>}
        />
      ) : (
        <ul className="stagger-cards flex flex-col gap-2">
          {exercises?.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center gap-3 rounded-2xl border border-gray-100/90 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-black/[0.04] hover:shadow-md hover:shadow-black/[0.06]"
            >
              <Link
                href={`/plans/${planId}/exercise/${ex.id}`}
                prefetch
                className="min-w-0 flex-1 cursor-pointer rounded-xl py-0.5 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
              >
                <p className="truncate font-medium text-gray-900">{ex.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className={exerciseKindTagClassName(toExerciseKind(ex))}>
                    {getExerciseKindTitle(toExerciseKind(ex))}
                  </span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(ex)}
                  className="p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeletingId(ex.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create exercise modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormError(''); }} title="Add exercise">
        <ExerciseForm
          form={form}
          setForm={setForm}
          error={formError}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setFormError(''); }}
          loading={createExercise.isPending}
          submitLabel="Add"
        />
      </Modal>

      {/* Edit exercise modal */}
      <Modal open={!!editingExercise} onClose={() => setEditingExercise(null)} title="Edit exercise">
        <ExerciseForm
          form={form}
          setForm={setForm}
          error={formError}
          onSubmit={handleUpdate}
          onCancel={() => setEditingExercise(null)}
          loading={updateExercise.isPending}
          submitLabel="Save"
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete exercise?">
        <p className="text-sm text-gray-600 mb-6">
          This will delete the exercise and all associated set data.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteExercise.isPending} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      <Modal
        open={startCountdownOpen}
        onClose={abortStartWorkoutCountdown}
        title={startCountdownError ? 'Could not start' : 'Get ready'}
      >
        {startCountdownError ? (
          <>
            <p className="mb-4 text-sm text-red-700">{startCountdownError}</p>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={abortStartWorkoutCountdown}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-center text-sm text-gray-600">Your workout will start in</p>
            <p
              className="mb-6 text-center text-6xl font-bold tabular-nums text-emerald-600"
              aria-live="polite"
            >
              {startCountdownSec}
            </p>
            <div className="flex justify-center">
              <Button type="button" variant="secondary" onClick={abortStartWorkoutCountdown}>
                Abort
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* FAB: start/resume + add exercise */}
      {fabOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[45] cursor-pointer bg-black/20 backdrop-blur-[1px]"
          aria-label="Close menu"
          onClick={() => setFabOpen(false)}
        />
      )}
      {/* Align FAB with main column (max-w-2xl + px-4), not viewport right edge */}
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-none flex w-full max-w-2xl justify-end">
          <div className="pointer-events-auto flex flex-col-reverse items-end gap-3">
        {/* column-reverse: first in DOM = bottom (main FAB) */}
        <button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          aria-expanded={fabOpen}
          aria-haspopup="menu"
          aria-label={fabOpen ? 'Close plan actions' : 'Plan actions'}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 transition-transform duration-200 ease-out active:scale-95 motion-reduce:transition-none"
        >
          <svg
            className={`h-7 w-7 transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none ${fabOpen ? 'rotate-45' : 'rotate-0'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {fabOpen && (
          <div className="flex flex-col-reverse items-end gap-3 stagger-fab-actions">
            {!activeWorkout && (
              <button
                type="button"
                title={
                  otherWorkoutActive
                    ? 'Finish the other workout first'
                    : !exercises?.length
                      ? 'Add an exercise first'
                      : undefined
                }
                disabled={workoutFabDisabled}
                onClick={async () => {
                  if (workoutFabDisabled) return;
                  setFabOpen(false);
                  setStartCountdownError('');
                  setStartCountdownSec(5);
                  setStartCountdownOpen(true);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/35 transition-transform enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {startWorkout.isPending ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Start workout
              </button>
            )}
            <button
              type="button"
              onClick={openAddExercise}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-lg transition-transform active:scale-[0.98]"
            >
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add exercise
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Exercise form component ─────────────────────────────────────────────────

const EXERCISE_KIND_OPTIONS: Array<{
  value: ExerciseKind;
  title: string;
  subtitle: string;
  examples: string;
}> = [
  {
    value: 'weighted_reps',
    title: 'Weighted reps',
    subtitle: 'kg × reps',
    examples: 'sztanga, hantle, maszyny',
  },
  {
    value: 'bodyweight_reps',
    title: 'Bodyweight reps',
    subtitle: 'reps',
    examples: 'pompki, podciągania, dipsy',
  },
  {
    value: 'time_based',
    title: 'Time-based',
    subtitle: 'Time passed',
    examples: 'plank, wall sit, hollow body',
  },
  {
    value: 'distance_per_time',
    title: 'Distance per time',
    subtitle: 'distance + time',
    examples: 'running, bicycle',
  },
];

interface ExerciseFormProps {
  form: { name: string; kind: ExerciseKind };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; kind: ExerciseKind }>>;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function ExerciseForm({ form, setForm, error, onSubmit, onCancel, loading, submitLabel }: ExerciseFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="Exercise name"
        placeholder="e.g. Bench Press"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        autoFocus
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Set type</label>
        <div className="grid grid-cols-1 gap-2">
          {EXERCISE_KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: option.value }))}
              className={`text-left p-3 rounded-xl border transition-all ${
                form.kind === option.value
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
              }`}
            >
              <p className="text-sm font-semibold">{option.title}</p>
              <p className={`text-xs ${form.kind === option.value ? 'text-emerald-100' : 'text-gray-500'}`}>
                {option.subtitle}
              </p>
              <p className={`text-xs mt-0.5 ${form.kind === option.value ? 'text-emerald-100' : 'text-gray-500'}`}>
                {option.examples}
              </p>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end mt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}
