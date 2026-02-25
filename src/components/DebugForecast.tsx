'use client';

import { useApp } from '@/hooks/useApp';
import { forecastDays } from '@/lib/progression';

export default function DebugForecast() {
  const { debugMode, currentExercise, isRestDay, allLogs } = useApp();

  if (!debugMode || !currentExercise) return null;

  const recentLogs = allLogs
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(-10);

  const days = forecastDays(currentExercise, recentLogs, isRestDay, 100);

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <h3 className="text-xs text-red-500 uppercase tracking-wider font-bold">
          Forecast 100 dni
        </h3>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-0.5 scrollbar-hide">
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-xs font-mono
              ${day.isToday
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : day.isRestDay
                  ? 'bg-amber-500/5 text-amber-500/60'
                  : 'text-ink-soft'
              }`}
          >
            <span className="text-ink-faint w-12">D{day.dayNumber}</span>
            {day.isRestDay ? (
              <span className="text-amber-500/60 flex-1 text-center">rest</span>
            ) : (
              <span className="flex-1 text-center font-bold">{day.target}</span>
            )}
            {day.isToday && (
              <span className="text-emerald-500 text-[10px] font-sans font-semibold">DZIŚ</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
