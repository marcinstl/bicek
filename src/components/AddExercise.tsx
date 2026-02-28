'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { previewTotalReps } from '@/lib/progression';

function getFrequencyHint(restDays: number): string {
  const training = 7 - restDays;
  if (restDays === 0) return 'Codziennie. Powtórzenia rosną powoli, ale stabilnie.';
  if (restDays <= 2) return `${training}x w tygodniu. Umiarkowany wzrost na sesję.`;
  if (restDays <= 4) return `${training}x w tygodniu. Szybszy wzrost na sesję.`;
  return `${training}x w tygodniu. Największy skok na sesję.`;
}

const NEW_CATALOG_VALUE = '__new__';

export default function AddExercise({ onClose }: { onClose: () => void }) {
  const { addExercise, catalogs } = useApp();
  const [name, setName] = useState('');
  const [startValue, setStartValue] = useState('');
  const [restDays, setRestDays] = useState(2);
  const [catalogChoice, setCatalogChoice] = useState<string>('');
  const [newCatalogName, setNewCatalogName] = useState('');

  const daysPerWeek = 7 - restDays;
  const startNum = parseInt(startValue) || 0;

  const totalReps30 = useMemo(() => {
    if (startNum < 1) return null;
    return previewTotalReps(startNum, daysPerWeek, 30);
  }, [startNum, daysPerWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || startNum < 1) return;
    const catalogId = catalogChoice === '' || catalogChoice === NEW_CATALOG_VALUE ? undefined : catalogChoice;
    const newName = catalogChoice === NEW_CATALOG_VALUE ? newCatalogName.trim() : undefined;
    await addExercise(name.trim(), startNum, daysPerWeek, catalogId ?? null, newName || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-edge rounded-2xl p-6 w-full max-w-sm space-y-5">
        <h2 className="text-lg font-bold text-ink">Nowe ćwiczenie</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
              Nazwa
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Pompki"
              required
              className="w-full py-2.5 px-3.5 bg-field border border-edge rounded-xl text-ink
                text-sm placeholder:text-ink-faint focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
              Startowa liczba powtórzeń
            </label>
            <input
              type="number"
              value={startValue}
              onChange={e => setStartValue(e.target.value)}
              placeholder="np. 10"
              required
              min={1}
              className="w-full py-2.5 px-3.5 bg-field border border-edge rounded-xl text-ink
                text-sm placeholder:text-ink-faint focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
              Katalog
            </label>
            <select
              value={catalogChoice}
              onChange={e => setCatalogChoice(e.target.value)}
              className="w-full py-2.5 px-3.5 bg-field border border-edge rounded-xl text-ink text-sm
                focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Brak katalogu</option>
              {catalogs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CATALOG_VALUE}>+ Nowy katalog...</option>
            </select>
            {catalogChoice === NEW_CATALOG_VALUE && (
              <input
                type="text"
                value={newCatalogName}
                onChange={e => setNewCatalogName(e.target.value)}
                placeholder="Nazwa katalogu, np. Ćwiczenia w domu"
                className="mt-2 w-full py-2 px-3 bg-field border border-edge rounded-xl text-ink text-sm
                  placeholder:text-ink-faint focus:outline-none focus:border-emerald-500/50"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
              Dni przerwy w tygodniu
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-faint tabular-nums w-4">0</span>
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={restDays}
                  onChange={e => setRestDays(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-field rounded-full appearance-none cursor-pointer
                    accent-emerald-500 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
                />
                <span className="text-xs text-ink-faint tabular-nums w-4">6</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {restDays} {restDays === 1 ? 'dzień' : 'dni'} przerwy
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {daysPerWeek}x / tydzień
                </span>
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                {getFrequencyHint(restDays)}
              </p>
            </div>
          </div>

          {totalReps30 !== null && startNum > 0 && (
            <div className="bg-field rounded-xl p-3 text-center">
              <span className="text-xs text-ink-faint">Łącznie w 30 dni: </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                ~{totalReps30} powtórzeń
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-ink-soft bg-field rounded-xl
                hover:bg-edge transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-sm text-white font-semibold bg-emerald-500 rounded-xl
                hover:bg-emerald-400 transition-colors active:scale-[0.98]"
            >
              Dodaj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
