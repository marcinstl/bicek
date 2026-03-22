'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkout, useWorkoutSets } from '@/hooks/useWorkout';
import { useExercises } from '@/hooks/useExercises';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { generateWorkoutSummary, formatSetText } from '@/lib/api';

interface Props {
  params: Promise<{ planId: string }>;
}

export default function WorkoutSummaryPage({ params }: Props) {
  const { planId } = use(params);
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId') ?? '';

  const { data: workout, isLoading: wLoading } = useWorkout(workoutId);
  const { data: sets = [], isLoading: sLoading } = useWorkoutSets(workoutId);
  const { data: exercises = [], isLoading: eLoading } = useExercises(planId);

  if (wLoading || sLoading || eLoading) return <PageSpinner />;
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/plans/${planId}`} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
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
          <p className="text-2xl font-bold text-emerald-600">
            {exercises.filter((ex) => sets.some((s) => s.exercise_id === ex.id)).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">exercises</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{sets.length}</p>
          <p className="text-xs text-gray-500 mt-1">sets</p>
        </div>
      </div>

      {/* Exercise breakdown */}
      <div className="flex flex-col gap-4 mb-6">
        {exercises
          .filter((ex) => sets.some((s) => s.exercise_id === ex.id))
          .map((ex) => {
            const exSets = sets.filter((s) => s.exercise_id === ex.id);
            return (
              <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{ex.name}</h3>
                <ul className="flex flex-col gap-1.5">
                  {exSets.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-gray-400 text-xs w-5 text-right">{i + 1}.</span>
                      {formatSetText(s, ex)}
                    </li>
                  ))}
                </ul>
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
        <Link href={`/plans/${planId}`} className="flex-1">
          <Button className="w-full">Back to plan</Button>
        </Link>
      </div>
    </div>
  );
}
