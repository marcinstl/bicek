'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/useApp';

export default function DebugPanel() {
  const { debugMode, getDebugInfo, setDebugDailyRate, simulateNextDay } = useApp();
  const [rateInput, setRateInput] = useState('');

  if (!debugMode) return null;

  const info = getDebugInfo();
  if (!info) return null;

  const handleSetRate = async () => {
    const val = parseFloat(rateInput);
    if (isNaN(val) || val < 0.002 || val > 0.015) return;
    await setDebugDailyRate(val);
    setRateInput('');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-red-950/95 border-t border-red-800 p-4 z-50 backdrop-blur-sm">
      <div className="max-w-sm mx-auto space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
            Debug Mode
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">dailyRate:</span>{' '}
            <span className="text-red-200 font-mono">{info.dailyRate.toFixed(4)}</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">effectiveRate:</span>{' '}
            <span className="text-red-200 font-mono">{info.effectiveRate.toFixed(4)}</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">Dzień:</span>{' '}
            <span className="text-red-200 font-mono">{info.currentDay}</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">Częstotliwość:</span>{' '}
            <span className="text-red-200 font-mono">{info.daysPerWeek}x/tydz</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">Regeneracja:</span>{' '}
            <span className="text-red-200 font-mono">{info.isRestDay ? 'TAK' : 'NIE'}</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2">
            <span className="text-red-400/70">Raw target:</span>{' '}
            <span className="text-red-200 font-mono">{info.rawTarget.toFixed(4)}</span>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2 col-span-2">
            <span className="text-red-400/70">Seria:</span>{' '}
            <span className="text-red-200 font-mono">{info.streak}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            step="0.001"
            min="0.002"
            max="0.015"
            value={rateInput}
            onChange={e => setRateInput(e.target.value)}
            placeholder="Nowy dailyRate"
            className="flex-1 py-1.5 px-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200
              text-xs placeholder:text-red-600 focus:outline-none"
          />
          <button
            onClick={handleSetRate}
            className="py-1.5 px-3 bg-red-800 text-red-200 rounded-lg text-xs hover:bg-red-700"
          >
            Ustaw
          </button>
          <button
            onClick={simulateNextDay}
            className="py-1.5 px-3 bg-red-800 text-red-200 rounded-lg text-xs hover:bg-red-700"
          >
            +1 dzień
          </button>
        </div>
      </div>
    </div>
  );
}
