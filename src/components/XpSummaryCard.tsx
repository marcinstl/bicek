'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/useApp';

export default function XpSummaryCard() {
  const { currentExercise, getMultiplierBreakdown } = useApp();
  const [showFormula, setShowFormula] = useState(false);
  const breakdown = getMultiplierBreakdown();

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-faint uppercase tracking-wider">Multiplier</span>
          <button
            type="button"
            onClick={() => setShowFormula((v) => !v)}
            className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline focus:outline-none"
            title={showFormula ? 'Ukryj wzór' : 'Pokaż wzór'}
          >
            {breakdown.mult.toFixed(2)}×
          </button>
        </div>
        {showFormula && currentExercise && (
          <div className="text-[10px] text-ink-faint/80 font-mono space-y-0.5">
            <p>dailyRate = {(currentExercise.dailyRate ?? 0).toFixed(4)} ({(currentExercise.dailyRate ?? 0) * 100}%)</p>
            <p>consistency = {(currentExercise.consistency ?? 0).toFixed(2)}</p>
            <p>rateNorm = {(breakdown.rateNorm * 100).toFixed(1)}% → 1 + 4×consistency×(0.5+0.5×rateNorm) = {breakdown.mult.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
