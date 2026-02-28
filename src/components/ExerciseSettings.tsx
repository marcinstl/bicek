'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/hooks/useApp';
import type { DailyLog } from '@/lib/types';

const NEW_CATALOG_VALUE = '__new__';

export default function ExerciseSettings() {
  const {
    currentExercise,
    todayLog,
    catalogs,
    getEffectiveDaysPerWeek,
    getCatalogForExercise,
    setExerciseCatalog,
    createCatalog,
    markCatalogRestDay,
    undoCatalogRestDay,
    deleteExercise,
    resetToday,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [catalogChoice, setCatalogChoice] = useState('');
  const [newCatalogName, setNewCatalogName] = useState('');

  useEffect(() => {
    setCatalogChoice(currentExercise?.catalogId ?? '');
  }, [currentExercise?.id, currentExercise?.catalogId]);

  const catalog = currentExercise ? getCatalogForExercise(currentExercise) : null;
  const isCatalogRestToday = !!(todayLog?.isRestDay && (todayLog as DailyLog & { catalogRest?: boolean }).catalogRest);

  if (!currentExercise) return null;

  const handleCatalogChange = async (value: string) => {
    if (value === NEW_CATALOG_VALUE) return;
    if (value === '') {
      await setExerciseCatalog(currentExercise.id, null);
      setCatalogChoice('');
      return;
    }
    const existing = catalogs.find(c => c.id === value);
    if (existing) {
      await setExerciseCatalog(currentExercise.id, value);
      setCatalogChoice(value);
    }
  };

  const handleCreateCatalogAndAssign = async () => {
    if (!newCatalogName.trim()) return;
    const dpw = getEffectiveDaysPerWeek(currentExercise);
    const c = await createCatalog(newCatalogName.trim(), dpw);
    await setExerciseCatalog(currentExercise.id, c.id);
    setCatalogChoice(c.id);
    setNewCatalogName('');
  };

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <h3 className="text-xs text-ink-faint uppercase tracking-wider font-medium">
        Ćwiczenie
      </h3>

      <div>
        <label className="block text-xs text-ink-faint mb-1.5 uppercase tracking-wider">
          Katalog
        </label>
        <select
          value={catalogChoice}
          onChange={e => {
            const v = e.target.value;
            setCatalogChoice(v);
            if (v !== NEW_CATALOG_VALUE) handleCatalogChange(v);
          }}
          className="w-full py-2 px-3 bg-field border border-edge rounded-xl text-ink text-sm
            focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Brak katalogu</option>
          {catalogs.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value={NEW_CATALOG_VALUE}>+ Nowy katalog...</option>
        </select>
        {catalogChoice === NEW_CATALOG_VALUE && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newCatalogName}
              onChange={e => setNewCatalogName(e.target.value)}
              placeholder="Nazwa katalogu"
              className="flex-1 py-2 px-3 bg-field border border-edge rounded-xl text-ink text-sm
                placeholder:text-ink-faint focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="button"
              onClick={handleCreateCatalogAndAssign}
              disabled={!newCatalogName.trim()}
              className="py-2 px-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10
                rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Dodaj
            </button>
          </div>
        )}
      </div>

      {catalog && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-ink-faint">
            Katalog: <span className="text-ink font-medium">{catalog.name}</span>
          </div>
          {isCatalogRestToday ? (
            <button
              type="button"
              onClick={() => undoCatalogRestDay(catalog.id)}
              className="w-full py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-xl
                border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              Cofnij przerwę katalogu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => markCatalogRestDay(catalog.id)}
              className="w-full py-2 text-xs font-medium text-ink-soft bg-field rounded-xl border border-edge
                hover:bg-edge transition-colors"
            >
              Dzisiaj przerwa dla całego katalogu
            </button>
          )}
        </div>
      )}

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
