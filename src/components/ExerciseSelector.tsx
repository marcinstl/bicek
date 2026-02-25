'use client';

import { useApp } from '@/hooks/useApp';

export default function ExerciseSelector() {
  const { exercises, currentExercise, selectExercise } = useApp();

  if (exercises.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {exercises.map(ex => (
        <button
          key={ex.id}
          onClick={() => selectExercise(ex.id)}
          className={`py-2 px-4 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0
            ${ex.id === currentExercise?.id
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-panel text-ink-soft border border-edge hover:border-ink-faint'
            }`}
        >
          {ex.name}
        </button>
      ))}
    </div>
  );
}
