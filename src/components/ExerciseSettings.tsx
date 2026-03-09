'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/useApp';

export default function ExerciseSettings() {
  const { currentExercise, deleteExercise, resetToday } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!currentExercise) return null;

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <h3 className="text-xs text-ink-faint uppercase tracking-wider font-medium">
        Ćwiczenie
      </h3>

      {confirmReset ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Zresetować dzisiejszy dzień? Wszystkie serie i oznaczenie przerwy zostaną usunięte.
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await resetToday();
                setConfirmReset(false);
              }}
              className="flex-1 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/15 rounded-xl
                border border-amber-500/25 hover:bg-amber-500/25 transition-colors active:scale-[0.98]"
            >
              Tak, resetuj
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="flex-1 py-2 text-xs text-ink-soft bg-field rounded-xl
                border border-edge hover:bg-edge transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmReset(true)}
          className="w-full py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-xl
            border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        >
          Zresetuj dzień
        </button>
      )}

      {confirmDelete ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Usunąć <span className="text-ink font-medium">{currentExercise.name}</span>?
            Wszystkie dane zostaną utracone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteExercise(currentExercise.id);
                setConfirmDelete(false);
              }}
              className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-xl
                hover:bg-red-500 transition-colors active:scale-[0.98]"
            >
              Tak, usuń
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 text-xs text-ink-soft bg-field rounded-xl
                border border-edge hover:bg-edge transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-2 text-xs font-medium text-red-500 bg-red-500/10 rounded-xl
            border border-red-500/20 hover:bg-red-500/20 transition-colors"
        >
          Usuń ćwiczenie
        </button>
      )}
    </div>
  );
}
