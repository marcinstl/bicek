'use client';

import { useApp } from '@/hooks/useApp';

export default function StatsCard() {
  const { currentExercise, getWeekTotal, getMonthTotal, getAllTimeTotal } = useApp();
  const streak = currentExercise?.streak ?? 0;

  const stats = [
    { label: 'Seria dni', value: streak, accent: streak >= 3 },
    { label: 'Ten tydzień', value: getWeekTotal() },
    { label: 'Ten miesiąc', value: getMonthTotal() },
    { label: 'Łącznie', value: getAllTimeTotal() },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="bg-panel border border-edge rounded-2xl p-4 text-center"
        >
          <div
            className={`text-2xl font-black tabular-nums ${
              s.accent ? 'text-emerald-500' : 'text-ink'
            }`}
          >
            {s.value.toLocaleString('pl-PL')}
          </div>
          <div className="text-xs text-ink-faint mt-0.5 uppercase tracking-wider">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
