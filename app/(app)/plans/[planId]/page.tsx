'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlans } from '@/hooks/usePlans';
import { useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise } from '@/hooks/useExercises';
import { useActiveWorkout, useStartWorkout } from '@/hooks/useWorkout';
import { useWorkoutTimer } from '@/components/providers/WorkoutTimerContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Exercise, ExerciseKind } from '@/lib/types';

interface Props {
  params: Promise<{ planId: string }>;
}

export default function PlanDetailPage({ params }: Props) {
  const { planId } = use(params);
  const router = useRouter();
  const { data: plans } = usePlans();
  const { data: exercises, isLoading } = useExercises(planId);
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

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/plans" className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{plan?.name ?? 'Plan'}</h1>
          <p className="text-sm text-gray-500">{exercises?.length ?? 0} exercises</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setFormError(''); setShowCreate(true); }} size="sm" variant="secondary">
          + Exercise
        </Button>
      </div>

      {/* Start / Resume workout */}
      <div className="mb-6">
        {activeWorkout ? (
          <button
            onClick={handleStartWorkout}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            Resume workout
          </button>
        ) : otherWorkoutActive ? (
          <div className="w-full bg-gray-100 border border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Another workout is already in progress
          </div>
        ) : (
          <Button
            onClick={handleStartWorkout}
            size="lg"
            className="w-full"
            loading={startWorkout.isPending}
            disabled={!exercises?.length}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start workout
          </Button>
        )}
      </div>

      {exercises?.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No exercises yet"
          description="Add your first exercise to this plan."
          action={
            <Button onClick={() => { setForm(emptyForm); setFormError(''); setShowCreate(true); }}>
              Add exercise
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises?.map((ex) => (
            <li key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{ex.name}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
                    {getKindLabel(toExerciseKind(ex))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
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

function getKindLabel(kind: ExerciseKind): string {
  return EXERCISE_KIND_OPTIONS.find((o) => o.value === kind)?.title ?? kind;
}

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
