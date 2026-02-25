'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/hooks/useApp';
import { displayTarget } from '@/lib/progression';

function getSetsKey(exerciseId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `bicek-sets-${exerciseId}-${today}`;
}

function loadSets(exerciseId: string): number[] {
  try {
    const raw = localStorage.getItem(getSetsKey(exerciseId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSets(exerciseId: string, sets: number[]) {
  localStorage.setItem(getSetsKey(exerciseId), JSON.stringify(sets));
}

function CoffeeIcon({ active }: { active: boolean }) {
  const sw = active ? 2.2 : 1.8;
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h1a4 4 0 010 8h-1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v3M10 2v3M14 2v3" />
    </svg>
  );
}

export default function TodayCard() {
  const { currentExercise, todayLog, isRestDay, setsVersion, completeDay, addMoreReps, skipRestDay, markTodayRest, undoTodayRest, getRestBudget } = useApp();
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentExercise) {
      setSets(loadSets(currentExercise.id));
    }
  }, [currentExercise?.id, todayLog, setsVersion]);

  if (!currentExercise) return null;

  const target = displayTarget(currentExercise.currentTarget);
  const alreadyDone = !!todayLog;
  const totalSets = sets.reduce((s, v) => s + v, 0);
  const currentTotal = alreadyDone ? todayLog.completed : totalSets;
  const budget = getRestBudget();

  const handleAddSet = () => {
    const val = parseInt(reps);
    if (isNaN(val) || val <= 0) return;
    const newSets = [...sets, val];
    setSets(newSets);
    saveSets(currentExercise.id, newSets);
    setReps('');
  };

  const handleFinishDay = async () => {
    if (totalSets <= 0) return;
    setSubmitting(true);
    await completeDay(totalSets);
    setSubmitting(false);
  };

  const handleAddMore = async () => {
    const val = parseInt(reps);
    if (isNaN(val) || val <= 0) return;
    setSubmitting(true);
    const newSets = [...sets, val];
    setSets(newSets);
    saveSets(currentExercise.id, newSets);
    await addMoreReps(val);
    setReps('');
    setSubmitting(false);
  };

  const handleRestDay = async () => {
    setSubmitting(true);
    await skipRestDay();
    setSubmitting(false);
  };

  const handleToggleRest = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (alreadyDone && todayLog.isRestDay) {
      await undoTodayRest();
    } else {
      await markTodayRest();
    }
    setSubmitting(false);
  };

  const todayIsRest = alreadyDone && todayLog.isRestDay;
  const canToggleRest = (!alreadyDone && budget.remaining > 0 && totalSets === 0) || todayIsRest;

  if (isRestDay && !alreadyDone) {
    return (
      <div className="bg-panel border border-edge rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-ink-soft uppercase tracking-wider font-medium">
            Dzisiaj - {currentExercise.name}
          </span>
        </div>
        <div className="text-center py-4 space-y-3">
          <div className="text-2xl font-bold text-amber-500">Dzień regeneracji</div>
          <p className="text-ink-faint text-sm">Twoje ciało potrzebuje odpoczynku</p>
          <button
            onClick={handleRestDay}
            disabled={submitting}
            className="mt-2 py-2.5 px-6 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-sm font-medium
              border border-amber-500/20 hover:bg-amber-500/20 transition-all active:scale-[0.98]
              disabled:opacity-50"
          >
            {submitting ? 'Zapisuję...' : 'Potwierdź odpoczynek'}
          </button>
        </div>
      </div>
    );
  }

  if (todayIsRest) {
    return (
      <div className="bg-panel border border-edge rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-ink-soft uppercase tracking-wider font-medium">
              Dzisiaj - {currentExercise.name}
            </span>
          </div>
          <button
            onClick={handleToggleRest}
            disabled={submitting}
            title="Cofnij przerwę"
            className="w-8 h-8 flex items-center justify-center rounded-lg
              text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            <CoffeeIcon active />
          </button>
        </div>
        <div className="text-center py-4">
          <p className="text-ink-soft text-sm">Dzień regeneracyjny</p>
          <p className="text-ink-faint text-xs mt-1">Kliknij ikonkę aby cofnąć</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-edge rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${alreadyDone ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs text-ink-soft uppercase tracking-wider font-medium">
            Dzisiaj - {currentExercise.name}
          </span>
        </div>
        {canToggleRest && (
          <button
            onClick={handleToggleRest}
            disabled={submitting}
            title="Dzisiaj przerwa"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint
              hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-50"
          >
            <CoffeeIcon active={false} />
          </button>
        )}
      </div>

      <div className="text-center">
        {currentTotal > 0 || alreadyDone ? (
          <>
            <div className="text-6xl font-black tabular-nums">
              <span className={currentTotal >= target ? 'text-emerald-500' : 'text-ink'}>
                {currentTotal}
              </span>
              <span className="text-ink-faint text-3xl font-bold">/{target}</span>
            </div>
            <p className="text-ink-faint text-sm mt-1">
              {alreadyDone ? 'Dzień zakończony' : 'Twój cel na dziś'}
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl font-black tabular-nums text-ink">{target}</div>
            <p className="text-ink-faint text-sm mt-1">Twój cel na dziś</p>
          </>
        )}
      </div>

      {sets.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-ink-faint uppercase tracking-wider font-medium text-center">
            Serie
          </div>
          <div className="flex flex-wrap items-center gap-1.5 justify-center">
            {sets.map((s, i) => (
              <span
                key={i}
                className="py-0.5 px-2 bg-field rounded-md text-xs text-ink-soft tabular-nums"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="number"
            value={reps}
            onChange={e => setReps(e.target.value)}
            placeholder="Seria..."
            min={1}
            className="flex-1 py-3 px-4 bg-field border border-edge rounded-xl text-ink text-center
              text-lg font-semibold placeholder:text-ink-faint placeholder:font-normal placeholder:text-sm
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
          {!alreadyDone ? (
            <button
              onClick={handleAddSet}
              disabled={!reps}
              className="py-3 px-4 bg-field border border-edge text-ink-soft rounded-xl text-sm font-medium
                hover:bg-edge transition-colors disabled:opacity-30"
            >
              +
            </button>
          ) : (
            <button
              onClick={handleAddMore}
              disabled={submitting || !reps}
              className="py-3 px-4 bg-field border border-edge text-ink-soft rounded-xl text-sm font-medium
                hover:bg-edge transition-colors disabled:opacity-30"
            >
              {submitting ? '...' : '+'}
            </button>
          )}
        </div>

        {!alreadyDone && (
          <button
            onClick={handleFinishDay}
            disabled={submitting || totalSets <= 0}
            className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm
              hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-40
              disabled:hover:bg-emerald-500 disabled:active:scale-100"
          >
            {submitting
              ? 'Zapisuję...'
              : totalSets > 0
                ? `Zakończ dzień (${totalSets})`
                : 'Zakończ dzień'
            }
          </button>
        )}

        {alreadyDone && !todayLog.isRestDay && (
          <p className="text-ink-faint text-xs text-center">
            Dzień zakończony. Możesz dodać kolejne serie.
          </p>
        )}
      </div>
    </div>
  );
}
