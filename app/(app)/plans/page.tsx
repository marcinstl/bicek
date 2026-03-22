'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans';
import { useWorkoutTimer } from '@/components/providers/WorkoutTimerContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Plan } from '@/lib/types';

export default function PlansPage() {
  const { data: plans, isLoading, error } = usePlans();
  const { activePlanId } = useWorkoutTimer();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <ul className="flex flex-col gap-3">
          {[...(plans ?? [])].sort((a, b) => {
            if (a.id === activePlanId) return -1;
            if (b.id === activePlanId) return 1;
            return 0;
          }).map((plan) => {
            const isActive = plan.id === activePlanId;
            return (
            <li
              key={plan.id}
              className={`rounded-2xl border shadow-sm overflow-hidden ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}
            >
              <div className="flex items-center">
                <Link
                  href={`/plans/${plan.id}`}
                  className="flex-1 px-4 py-4 hover:bg-black/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(plan.created_at).toLocaleDateString()}
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
