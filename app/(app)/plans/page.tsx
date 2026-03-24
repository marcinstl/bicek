'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans';
import { useWorkoutHistory } from '@/hooks/useWorkout';
import { useWorkoutTimer } from '@/components/providers/WorkoutTimerContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Plan } from '@/lib/types';

export default function PlansPage() {
  const router = useRouter();
  const { data: plans, isLoading, error } = usePlans();
  const { data: workoutHistory = [] } = useWorkoutHistory();
  const { activePlanId } = useWorkoutTimer();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createPlan.mutateAsync({ name: newName.trim() });
    setNewName('');
    setShowCreate(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan || !editName.trim()) return;
    await updatePlan.mutateAsync({ id: editingPlan.id, input: { name: editName.trim() } });
    setEditingPlan(null);
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deletePlan.mutateAsync(deletingId);
    setDeletingId(null);
  }

  function getLatestWorkoutTimeByPlan() {
    const latestByPlan = new Map<string, number>();
    for (const workout of workoutHistory) {
      if (!workout.ended_at) continue;
      const ts = new Date(workout.ended_at).getTime();
      const prev = latestByPlan.get(workout.plan_id);
      if (prev == null || ts > prev) latestByPlan.set(workout.plan_id, ts);
    }
    return latestByPlan;
  }

  function formatRelativeTime(dateMs: number): string {
    const diffMs = nowMs - dateMs;
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (minutes < 1) return rtf.format(0, 'second');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 30) return rtf.format(-days, 'day');
    if (months < 12) return rtf.format(-months, 'month');
    return rtf.format(-years, 'year');
  }

  const latestWorkoutByPlan = getLatestWorkoutTimeByPlan();
  const sortedPlans = useMemo(
    () =>
      [...(plans ?? [])].sort((a, b) => {
        const aLast = latestWorkoutByPlan.get(a.id);
        const bLast = latestWorkoutByPlan.get(b.id);

        // Plans without workouts come first.
        if (aLast == null && bLast != null) return -1;
        if (aLast != null && bLast == null) return 1;

        // Plans with a known last workout are sorted oldest -> newest.
        if (aLast != null && bLast != null) return aLast - bLast;

        // Keep deterministic order for plans without workouts.
        if (a.id === activePlanId) return -1;
        if (b.id === activePlanId) return 1;
        return a.created_at.localeCompare(b.created_at);
      }),
    [plans, latestWorkoutByPlan, activePlanId]
  );

  useEffect(() => {
    // Warm up route payloads so click navigation feels instant.
    for (const plan of sortedPlans.slice(0, 6)) {
      router.prefetch(`/plans/${plan.id}`);
    }
  }, [router, sortedPlans]);

  if (isLoading) return <PageSpinner />;
  if (error) return <div className="text-red-600 text-sm p-4">Failed to load plans</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Plans</h1>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New plan
        </Button>
      </div>

      {plans?.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title="No plans yet"
          description="Create your first workout plan to get started."
          action={
            <Button onClick={() => setShowCreate(true)}>
              Create first plan
            </Button>
          }
        />
      ) : (
        <ul className="stagger-cards flex flex-col gap-3">
          {sortedPlans.map((plan) => {
            const isActive = plan.id === activePlanId;
            const lastWorkoutTs = latestWorkoutByPlan.get(plan.id);
            return (
            <li
              key={plan.id}
              className={
                isActive
                  ? 'rounded-2xl p-px bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 overflow-hidden'
                  : 'rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md hover:shadow-black/[0.06]'
              }
            >
              <div
                className={`flex items-center overflow-hidden ${isActive ? 'rounded-[15px] bg-emerald-50/95' : 'bg-white/95'}`}
              >
                <Link
                  href={`/plans/${plan.id}`}
                  prefetch
                  onMouseEnter={() => router.prefetch(`/plans/${plan.id}`)}
                  onTouchStart={() => router.prefetch(`/plans/${plan.id}`)}
                  onClick={() => setOpeningPlanId(plan.id)}
                  className="flex-1 px-4 py-4 hover:bg-black/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    {openingPlanId === plan.id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium">
                        opening...
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last workout: {lastWorkoutTs ? formatRelativeTime(lastWorkoutTs) : 'never'}
                  </p>
                </Link>
                <div className="flex items-center gap-1 pr-3">
                  <button
                    onClick={() => { setEditingPlan(plan); setEditName(plan.name); }}
                    className="p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    aria-label="Edit plan"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => !isActive && setDeletingId(plan.id)}
                    disabled={isActive}
                    title={isActive ? 'Finish the workout first' : 'Delete plan'}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                    aria-label="Delete plan"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          );})}
        </ul>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setNewName(''); }} title="New plan">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Plan name"
            placeholder="e.g. Push Day, Full Body"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setNewName(''); }}>
              Cancel
            </Button>
            <Button type="submit" loading={createPlan.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingPlan} onClose={() => setEditingPlan(null)} title="Edit plan">
        <form onSubmit={handleEdit} className="flex flex-col gap-4">
          <Input
            label="Plan name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={updatePlan.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete plan?">
        <p className="text-sm text-gray-600 mb-6">
          This will permanently delete the plan and all its exercises. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deletePlan.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
