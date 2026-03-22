'use client';

import Link from 'next/link';
import { useWorkoutHistory } from '@/hooks/useWorkout';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';

export default function HistoryPage() {
  const { data: workouts, isLoading, error } = useWorkoutHistory();

  if (isLoading) return <PageSpinner />;
  if (error) return <div className="text-red-600 text-sm p-4">Failed to load history</div>;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function getDurationMin(started: string, ended: string | null) {
    if (!ended) return null;
    return Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">History</h1>

      {workouts?.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No completed workouts"
          description="Complete your first workout to see it here."
          action={
            <Link href="/plans">
              <button className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                Go to plans
              </button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts?.map((w) => {
            const duration = getDurationMin(w.started_at, w.ended_at);
            return (
              <li key={w.id}>
                <Link
                  href={`/plans/${w.plan_id}/workout/summary?workoutId=${w.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 hover:border-emerald-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {(w as typeof w & { plans?: { name: string } }).plans?.name ?? 'Workout'}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(w.started_at)} · {formatTime(w.started_at)}
                      </p>
                    </div>
                    {duration !== null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-emerald-600">{duration}</p>
                        <p className="text-xs text-gray-400">min</p>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
