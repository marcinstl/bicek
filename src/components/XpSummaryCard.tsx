'use client';

import { useApp } from '@/hooks/useApp';
import { xpMultiplierFromRateAndStreak } from '@/lib/xp';

export default function XpSummaryCard() {
  const { user, currentExercise, getMonthXpTotal } = useApp();
  const monthXp = getMonthXpTotal();
  const totalXp = user?.totalXp ?? 0;
  const multiplier = currentExercise
    ? xpMultiplierFromRateAndStreak(currentExercise.dailyRate, currentExercise.streak)
    : 1;

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-faint uppercase tracking-wider">Multiplier</span>
          <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{multiplier.toFixed(2)}×</span>
        </div>
        <p className="text-[10px] text-ink-faint/80">
          1 + 4 × (0.5×rateNorm + 0.5×streakNorm), 1–5
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint uppercase tracking-wider">Ten miesiąc</span>
        <span className="text-lg font-bold tabular-nums text-ink">{monthXp.toLocaleString('pl-PL')} XP</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint uppercase tracking-wider">Łącznie</span>
        <span className="text-lg font-bold tabular-nums text-ink">{totalXp.toLocaleString('pl-PL')} XP</span>
      </div>
    </div>
  );
}
