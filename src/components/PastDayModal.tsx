'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/useApp';
import { DailyLog } from '@/lib/types';

const DAY_NAMES: Record<number, string> = {
  1: 'Poniedziałek', 2: 'Wtorek', 3: 'Środa',
  4: 'Czwartek', 5: 'Piątek', 6: 'Sobota', 0: 'Niedziela',
};

export default function PastDayModal({ log, onClose }: { log: DailyLog; onClose: () => void }) {
  const { editPastLog } = useApp();
  const [reps, setReps] = useState(log.isRestDay ? '' : String(log.completed));
  const [saving, setSaving] = useState(false);

  const dateObj = new Date(log.date + 'T00:00:00');
  const dayName = DAY_NAMES[dateObj.getDay()];
  const dateLabel = `${dayName}, ${dateObj.getDate()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

  const handleSave = async () => {
    const val = parseInt(reps);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    await editPastLog(log.id, val);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-edge rounded-2xl p-6 w-full max-w-xs space-y-4">
        <div>
          <h3 className="font-bold text-ink text-[16px]">{dateLabel}</h3>
          <p className="text-xs text-ink-faint mt-0.5">
            Cel: {log.target} ·
            {log.isRestDay
              ? ' Oznaczony jako przerwa'
              : ` Wykonane: ${log.completed}`
            }
          </p>
        </div>

        <div>
          <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
            Powtórzenia
          </label>
          <input
            type="number"
            value={reps}
            onChange={e => setReps(e.target.value)}
            placeholder="0"
            min={0}
            className="w-full py-2.5 px-3.5 bg-field border border-edge rounded-xl text-ink
              text-lg text-center font-semibold placeholder:text-ink-faint
              focus:outline-none focus:border-emerald-500/50"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-ink-soft bg-field rounded-xl
              hover:bg-edge transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm text-white font-semibold bg-emerald-500 rounded-xl
              hover:bg-emerald-400 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  );
}
