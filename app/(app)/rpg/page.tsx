'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { SpriteIcon } from '@/components/SpriteIcon';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useSetsForWorkouts, useWorkoutHistory } from '@/hooks/useWorkout';
import {
  useEquipRpgItem,
  useRpgDiscoveries,
  useRpgEquipment,
  useRpgItems,
  useUnequipRpgItem,
  rpgKeys,
} from '@/hooks/useRpgEquipment';
import { isOfflineMode, tryDiscoverItems } from '@/lib/api-router';
import { getLevelProgress } from '@/lib/rpg/leveling';
import { computeSetXp } from '@/lib/rpg/xp';
import { applyXpRates, applyKindRate } from '@/lib/rpg/buffs';
import type { ExerciseKind, RpgRequirement, XpRates } from '@/lib/types';
import { getExerciseKindTitle, kindBuffBadgeClassName } from '@/lib/exercise-stats';

const DEFAULT_XP_RATES: XpRates = {
  weighted_reps: 100,
  bodyweight_reps: 100,
  time_based: 100,
  distance_per_time: 100,
  total: 100,
};

type RpgEvent = {
  key: string;
  workoutId: string;
  timestamp: string;
  workoutTimeMs: number;
  planName: string;
  gainedXp: number;
  levelUpLabel: string | null;
  xpRates: XpRates;
};

const KIND_ORDER: ExerciseKind[] = [
  'weighted_reps',
  'bodyweight_reps',
  'time_based',
  'distance_per_time',
];

const KIND_BAR_FILL_CLASS: Record<ExerciseKind, string> = {
  weighted_reps: 'bg-orange-500',
  bodyweight_reps: 'bg-violet-500',
  time_based: 'bg-sky-500',
  distance_per_time: 'bg-rose-500',
};

const EQUIPMENT_SLOTS = [
  { id: 'slot-coin', row: 1, col: 1 },
  { id: 'slot-head', row: 1, col: 2 },
  { id: 'slot-potion', row: 1, col: 3 },
  { id: 'slot-weapon', row: 2, col: 1 },
  { id: 'slot-armor', row: 2, col: 2 },
  { id: 'slot-shield', row: 2, col: 3 },
  { id: 'slot-ring', row: 3, col: 1 },
  { id: 'slot-legs', row: 3, col: 2 },
  { id: 'slot-tool', row: 3, col: 3 },
  { id: 'slot-boots', row: 4, col: 2 },
] as const;

type EquipmentSlotId = (typeof EQUIPMENT_SLOTS)[number]['id'];
type EquippedBySlot = Partial<Record<EquipmentSlotId, string>>;
const EQUIPMENT_STORAGE_KEY = 'rpg-equipment-v1';
const EQUIPMENT_MIGRATION_KEY = 'rpg-equipment-migrated-v1';

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBuff(buff: import('@/lib/types').RpgItemBuff): { label: string; className: string } {
  const kind = buff.kind ?? 'total';
  const kindLabel = kind !== 'total' ? getExerciseKindTitle(kind as ExerciseKind) : 'Global';
  return {
    label: `+${buff.value}% ${kindLabel} XP`,
    className: kindBuffBadgeClassName(kind),
  };
}

function formatRequirement(req: RpgRequirement): string {
  switch (req.type) {
    case 'total_level': return `Poziom ${req.level}`;
    case 'kind_level': return `${getExerciseKindTitle(req.kind)} Lv.${req.level}`;
    case 'total_xp': return `${req.xp} XP`;
    case 'workout_count': return `${req.count} treningów`;
    case 'secret': return '???';
    default: return '???';
  }
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onToggleAll,
  formatOption,
}: {
  label: string;
  options: string[];
  selected: Set<string> | null;
  onToggle: (opt: string) => void;
  onToggleAll: () => void;
  formatOption?: (opt: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const allSelected = selected === null;
  const isChecked = (opt: string) => selected === null || selected.has(opt);
  const selectedCount = selected?.size ?? options.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
          allSelected
            ? 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}
      >
        {label}
        {!allSelected && (
          <span className="rounded-full bg-blue-100 px-1 text-[10px] font-semibold text-blue-700">
            {selectedCount}
          </span>
        )}
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[150px] rounded-xl border border-gray-200 bg-white shadow-lg py-1 overflow-hidden">
          <button
            type="button"
            onClick={onToggleAll}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Checkbox checked={allSelected} />
            <span>All</span>
          </button>
          <div className="my-0.5 border-t border-gray-100" />
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Checkbox checked={isChecked(opt)} />
              <span>{formatOption ? formatOption(opt) : opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
        checked ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'
      }`}
    >
      {checked && (
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

export default function RpgPage() {
  const offline = isOfflineMode();
  const queryClient = useQueryClient();
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory();
  const workoutIds = useMemo(() => history.map((w) => w.id), [history]);
  const { data: sets = [], isLoading: setsLoading } = useSetsForWorkouts(workoutIds, workoutIds.length > 0);
  const { data: items = [], isLoading: itemsLoading } = useRpgItems();
  const { data: discoveries = [], isLoading: discoveriesLoading } = useRpgDiscoveries();
  const { data: equipmentRows = [], isLoading: equipmentLoading } = useRpgEquipment();
  const equipMutation = useEquipRpgItem();
  const unequipMutation = useUnequipRpgItem();

  const [localEquippedBySlot, setLocalEquippedBySlot] = useState<EquippedBySlot>({});
  const [equipmentHydrated, setEquipmentHydrated] = useState(false);
  const [migrationAttempted, setMigrationAttempted] = useState(false);
  const [showTotalExp, setShowTotalExp] = useState(true);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [invSlotFilter, setInvSlotFilter] = useState<Set<string> | null>(null);
  const [invBuffFilter, setInvBuffFilter] = useState<Set<string> | null>(null);
  const [compareItemId, setCompareItemId] = useState<string | null>(null);
  const [compareItemBId, setCompareItemBId] = useState<string | null>(null);

  const discoverTriggered = useRef(false);
  const dataReady = !itemsLoading && !discoveriesLoading && !historyLoading && !(workoutIds.length > 0 && setsLoading);

  useEffect(() => {
    if (!dataReady) return;
    if (discoverTriggered.current) return;
    discoverTriggered.current = true;
    void tryDiscoverItems().then((newIds) => {
      if (newIds.length > 0) {
        void queryClient.invalidateQueries({ queryKey: rpgKeys.discoveries() });
        void queryClient.invalidateQueries({ queryKey: rpgKeys.items() });
      }
    });
  }, [dataReady, queryClient]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EquippedBySlot;
        setLocalEquippedBySlot(parsed);
      }
    } catch {
      // Ignore malformed localStorage data.
    } finally {
      setEquipmentHydrated(true);
    }
  }, []);

  const itemById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item] as const));
  }, [items]);
  const discoveredItemIds = useMemo(() => new Set(discoveries.map((d) => d.item_id)), [discoveries]);

  const invSlotOptions = useMemo(
    () => [...new Set(items.filter((i) => discoveredItemIds.has(i.id)).map((i) => i.eq_slot))].sort(),
    [items, discoveredItemIds],
  );
  const invBuffKindOptions = useMemo(() => {
    const kinds = new Set<string>();
    let hasNoBuff = false;
    for (const item of items) {
      if (!discoveredItemIds.has(item.id)) continue;
      const buffs = item.buffs ?? [];
      if (buffs.length === 0) { hasNoBuff = true; continue; }
      for (const b of buffs) kinds.add(b.kind ?? 'total');
    }
    return [...(hasNoBuff ? ['—'] : []), ...[...kinds].sort()];
  }, [items, discoveredItemIds]);

  const remoteEquippedBySlot = useMemo<EquippedBySlot>(() => {
    const mapped: EquippedBySlot = {};
    for (const row of equipmentRows) {
      const slot = row.item?.eq_slot as EquipmentSlotId | undefined;
      if (!slot || !EQUIPMENT_SLOTS.some((s) => s.id === slot)) continue;
      mapped[slot] = row.item?.id;
    }
    return mapped;
  }, [equipmentRows]);

  const hasRemoteEquipment = useMemo(
    () => Object.values(remoteEquippedBySlot).some((code) => typeof code === 'string' && code.length > 0),
    [remoteEquippedBySlot]
  );

  const equippedBySlot = hasRemoteEquipment ? remoteEquippedBySlot : localEquippedBySlot;

  useEffect(() => {
    if (!equipmentHydrated) return;
    window.localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(localEquippedBySlot));
  }, [localEquippedBySlot, equipmentHydrated]);

  useEffect(() => {
    if (offline) return;
    if (!equipmentHydrated) return;
    if (items.length === 0) return;
    if (hasRemoteEquipment) return;
    if (migrationAttempted) return;
    if (window.localStorage.getItem(EQUIPMENT_MIGRATION_KEY) === 'true') return;

    const localEntries = Object.entries(localEquippedBySlot).filter(
      (entry): entry is [EquipmentSlotId, string] => typeof entry[1] === 'string' && entry[1].length > 0
    );
    if (localEntries.length === 0) {
      setMigrationAttempted(true);
      return;
    }

    // Legacy localStorage migration is no longer supported (items switched to sprite sheet system).
    setMigrationAttempted(true);
    window.localStorage.setItem(EQUIPMENT_MIGRATION_KEY, 'true');
  }, [
    equipmentHydrated,
    hasRemoteEquipment,
    items.length,
    localEquippedBySlot,
    migrationAttempted,
    offline,
  ]);

  const handleEquipItem = (itemId: string, eqSlot: EquipmentSlotId) => {
    if (!discoveredItemIds.has(itemId)) return;

    if (offline) {
      setLocalEquippedBySlot((prev) => {
        if (prev[eqSlot] === itemId) {
          const next = { ...prev };
          delete next[eqSlot];
          return next;
        }
        return { ...prev, [eqSlot]: itemId };
      });
      return;
    }

    const item = itemById.get(itemId);
    if (!item || item.eq_slot !== eqSlot) return;

    const currentCode = equippedBySlot[eqSlot];
    if (currentCode === itemId) {
      void unequipMutation.mutateAsync(itemId);
      return;
    }
    void equipMutation.mutateAsync({ item_id: itemId });
  };

  useEffect(() => {
    if (!menuItemId) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-inventory-menu]')) {
        setMenuItemId(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuItemId]);

  // Compute effective XP per workout (applying xp_rates buffs) and aggregate totals
  const xpStats = useMemo(() => {
    const setsByWorkout = new Map<string, typeof sets>();
    for (const set of sets) {
      const arr = setsByWorkout.get(set.workout_id);
      if (arr) arr.push(set);
      else setsByWorkout.set(set.workout_id, [set]);
    }

    let totalXp = 0;
    const kindTotals: Record<ExerciseKind, number> = {
      weighted_reps: 0,
      bodyweight_reps: 0,
      time_based: 0,
      distance_per_time: 0,
    };
    const workoutEffectiveXp = new Map<string, number>();

    for (const workout of history) {
      const workoutSets = setsByWorkout.get(workout.id) ?? [];
      const baseKindXp: Record<ExerciseKind, number> = {
        weighted_reps: 0,
        bodyweight_reps: 0,
        time_based: 0,
        distance_per_time: 0,
      };
      for (const set of workoutSets) {
        const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
        baseKindXp[set.exercises.kind] += xp;
      }

      const rates = (workout.xp_rates ?? DEFAULT_XP_RATES) as XpRates;

      // Total XP for overall level: only total rate applies
      const workoutEffective = applyXpRates(baseKindXp, rates);
      workoutEffectiveXp.set(workout.id, workoutEffective);
      totalXp += workoutEffective;

      // Per-kind totals: each kind uses its own rate (independent of total)
      for (const kind of KIND_ORDER) {
        kindTotals[kind] += applyKindRate(baseKindXp[kind], rates[kind]);
      }
    }

    const workoutXpRates = new Map<string, XpRates>(
      history.map((w) => [w.id, (w.xp_rates ?? DEFAULT_XP_RATES) as XpRates])
    );

    return { totalXp, kindTotals, workoutEffectiveXp, workoutXpRates, setsByWorkout };
  }, [history, sets]);

  const totalXp = xpStats.totalXp;
  const kindTotals = xpStats.kindTotals;


  const progress = getLevelProgress(totalXp);
  const loading =
    historyLoading ||
    (workoutIds.length > 0 && setsLoading) ||
    itemsLoading ||
    discoveriesLoading ||
    equipmentLoading;
  const events = useMemo<RpgEvent[]>(() => {
    if (loading) return [];

    const { workoutEffectiveXp, workoutXpRates } = xpStats;

    const ordered = [...history].sort((a, b) => {
      const aMs = new Date(a.ended_at ?? a.started_at).getTime();
      const bMs = new Date(b.ended_at ?? b.started_at).getTime();
      return bMs - aMs;
    });
    const workoutEvents: RpgEvent[] = [];
    let cumulativeXp = totalXp;

    for (const workout of ordered) {
      const afterLevel = getLevelProgress(cumulativeXp).level;
      const workoutXp = workoutEffectiveXp.get(workout.id) ?? 0;
      cumulativeXp -= workoutXp;
      const beforeLevel = getLevelProgress(Math.max(0, cumulativeXp)).level;

      const workoutTimestamp = workout.ended_at ?? workout.started_at;
      const workoutTimeMs = new Date(workoutTimestamp).getTime();
      const planName = (workout as typeof workout & { plans?: { name?: string | null } }).plans?.name ?? 'Workout';

      const levelUpLabel = afterLevel > beforeLevel ? `Level Up ${beforeLevel} > ${afterLevel}` : null;

      workoutEvents.push({
        key: `workout-${workout.id}`,
        workoutId: workout.id,
        timestamp: workoutTimestamp,
        workoutTimeMs,
        planName,
        gainedXp: workoutXp,
        levelUpLabel,
        xpRates: workoutXpRates.get(workout.id) ?? DEFAULT_XP_RATES,
      });
    }

    return workoutEvents
      .sort((a, b) => {
        if (b.workoutTimeMs !== a.workoutTimeMs) return b.workoutTimeMs - a.workoutTimeMs;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 10);
  }, [history, loading, xpStats, totalXp]);

  return (
    <div className="relative pb-28">
      <div className="rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Poziom {progress.level}</h2>
            </div>

            <div className="mt-4 w-full max-w-sm">
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span />
                <span>{progress.nextLevelXp} Exp</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100">
                <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${progress.progressPct}%` }} />
              </div>
              <div className="mt-3 text-left">
                {loading ? (
                  <p className="text-xs text-gray-400">Liczenie XP...</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTotalExp((prev) => !prev)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showTotalExp ? `Total Exp: ${progress.totalXp}` : `Potrzebny Exp: ${progress.xpToNextLevel}`}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 max-w-sm space-y-2">
              {KIND_ORDER.map((kind) => {
                const xp = kindTotals[kind];
                const { level, progressPct: pct } = getLevelProgress(xp);
                return (
                  <div key={kind}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">{getExerciseKindTitle(kind)}</span>
                      <span className="text-xs font-medium text-gray-700">{level}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${KIND_BAR_FILL_CLASS[kind]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-300/80 bg-slate-900/5 p-3 flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 self-start">Equipment</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 56px)', gridTemplateRows: 'repeat(4, 56px)' }}>
              {EQUIPMENT_SLOTS.map((slot) => (
                <div
                  key={slot.id}
                  className="flex h-14 w-14 items-center justify-center rounded-md border border-gray-300 bg-gray-50"
                  style={{ gridColumnStart: slot.col, gridRowStart: slot.row }}
                >
                  {equippedBySlot[slot.id] ? (() => {
                    const itemId = equippedBySlot[slot.id]!;
                    const item = itemById.get(itemId);
                    if (!item?.sprite_positions?.length) return null;
                    return (
                      <SpriteIcon
                        positions={item.sprite_positions}
                        size={48}
                      />
                    );
                  })() : null}
                </div>
              ))}
            </div>
            {(() => {
              const activeBuffs: { buff: import('@/lib/types').RpgItemBuff }[] = [];
              for (const itemId of Object.values(equippedBySlot)) {
                if (!itemId) continue;
                const item = itemById.get(itemId);
                for (const buff of item?.buffs ?? []) {
                  activeBuffs.push({ buff });
                }
              }
              if (activeBuffs.length === 0) return null;
              return (
                <div className="mt-3 self-start w-full">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Aktywne buffy</p>
                  <div className="flex flex-wrap gap-1">
                    {activeBuffs.map(({ buff }, i) => {
                      const { label, className } = formatBuff(buff);
                      return <span key={i} className={className}>{label}</span>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Inventory */}
      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        {(() => {
          const discoveryByItemId = new Map(discoveries.map((d) => [d.item_id, d]));
          const discovered = items
            .filter((item) => discoveredItemIds.has(item.id))
            .sort((a, b) => {
              const da = discoveryByItemId.get(a.id)?.discovered_at ?? '';
              const db = discoveryByItemId.get(b.id)?.discovered_at ?? '';
              return db.localeCompare(da);
            });

          const detailItem = detailItemId ? discovered.find((i) => i.id === detailItemId) ?? null : null;
          const compareItem = compareItemId ? discovered.find((i) => i.id === compareItemId) ?? null : null;

          // ── Compare view ──
          if (compareItem) {
            const compareItemB = compareItemBId ? discovered.find((i) => i.id === compareItemBId) ?? null : null;

            const renderItemCard = (item: typeof discovered[number]) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <SpriteIcon positions={item.sprite_positions!} size={48} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{item.name ?? '???'}</p>
                    <p className="text-[10px] text-gray-400">{item.item_type ?? '—'} · {item.eq_slot.replace('slot-', '')}</p>
                  </div>
                </div>
                {(item.requirements ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(item.requirements ?? []).map((req, idx) => (
                      <span key={idx} className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                        {formatRequirement(req)}
                      </span>
                    ))}
                  </div>
                )}
                {(item.buffs ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(item.buffs ?? []).map((buff, idx) => {
                      const { label, className } = formatBuff(buff);
                      return <span key={idx} className={className}>{label}</span>;
                    })}
                  </div>
                )}
                {(item.buffs ?? []).length === 0 && (item.requirements ?? []).length === 0 && (
                  <p className="text-[10px] text-gray-400 italic">No buffs</p>
                )}
              </div>
            );

            return (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setCompareItemId(null); setCompareItemBId(null); }}
                    className="rounded-lg p-1 -ml-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    aria-label="Wróć do Inventory"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-900">Compare</h3>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {/* Left: item A */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5">
                    {renderItemCard(compareItem)}
                  </div>

                  {/* Right: item B card or picker grid */}
                  {compareItemB ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5">
                      {renderItemCard(compareItemB)}
                      <button
                        type="button"
                        onClick={() => setCompareItemBId(null)}
                        className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Pick to compare</p>
                      <div className="flex flex-wrap gap-2">
                        {discovered.map((item) => {
                          const isMenuOpen = menuItemId === item.id;
                          const isLeft = item.id === compareItem.id;
                          return (
                            <div key={item.id} className="relative" data-inventory-menu>
                              <button
                                type="button"
                                onClick={() => isLeft ? undefined : setMenuItemId(isMenuOpen ? null : item.id)}
                                disabled={isLeft}
                                className={`flex h-14 w-14 items-center justify-center rounded-xl border transition-colors ${
                                  isLeft
                                    ? 'border-blue-300 bg-blue-100 opacity-40 cursor-not-allowed'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <SpriteIcon positions={item.sprite_positions!} size={48} />
                              </button>
                              {isMenuOpen && !isLeft && (
                                <div
                                  className="absolute bottom-full left-0 z-20 mb-1.5 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                                  data-inventory-menu
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setCompareItemBId(item.id); setMenuItemId(null); }}
                                    className="flex w-full items-center whitespace-nowrap px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    Compare
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          }

          // ── Detail view ──
          if (detailItem) {
            const isEquipped = equippedBySlot[detailItem.eq_slot as EquipmentSlotId] === detailItem.id;
            return (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailItemId(null)}
                    className="rounded-lg p-1 -ml-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    aria-label="Wróć do Inventory"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-900">Inventory</h3>
                </div>
                <div className="mt-3 flex items-start gap-4">
                  <SpriteIcon positions={detailItem.sprite_positions!} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{detailItem.name ?? '???'}</p>
                    <p className="text-xs text-gray-500">{detailItem.item_type ?? '—'} · {detailItem.eq_slot}</p>
                    {(detailItem.requirements ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(detailItem.requirements ?? []).map((req, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200"
                          >
                            {formatRequirement(req)}
                          </span>
                        ))}
                      </div>
                    )}
                    {detailItem.buffs && detailItem.buffs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {detailItem.buffs.map((buff, idx) => {
                          const { label, className } = formatBuff(buff);
                          return <span key={idx} className={className}>{label}</span>;
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEquipItem(detailItem.id, detailItem.eq_slot as EquipmentSlotId)}
                      className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {isEquipped ? 'Unequip' : 'Equip'}
                    </button>
                  </div>
                </div>
              </>
            );
          }

          // ── Grid view ──
          const toggleSlot = (opt: string) => {
            setInvSlotFilter((prev) => {
              const cur = prev ?? new Set(invSlotOptions);
              const next = new Set(cur);
              if (next.has(opt)) next.delete(opt); else next.add(opt);
              if (next.size === 0) return new Set([opt]);
              return next.size === invSlotOptions.length ? null : next;
            });
          };
          const toggleBuff = (opt: string) => {
            setInvBuffFilter((prev) => {
              const cur = prev ?? new Set(invBuffKindOptions);
              const next = new Set(cur);
              if (next.has(opt)) next.delete(opt); else next.add(opt);
              if (next.size === 0) return new Set([opt]);
              return next.size === invBuffKindOptions.length ? null : next;
            });
          };
          const formatBuffKind = (k: string) => {
            if (k === '—') return 'No buff';
            if (k === 'total') return 'Global XP';
            try { return getExerciseKindTitle(k as ExerciseKind); } catch { return k; }
          };

          const applyFilters = (list: typeof discovered) =>
            list.filter((item) => {
              if (invSlotFilter !== null && !invSlotFilter.has(item.eq_slot)) return false;
              if (invBuffFilter !== null) {
                const kinds = (item.buffs ?? []).map((b) => b.kind ?? 'total');
                if (kinds.length === 0) return invBuffFilter.has('—');
                return kinds.some((k) => invBuffFilter.has(k));
              }
              return true;
            });

          const equipped = applyFilters(
            discovered.filter((item) => equippedBySlot[item.eq_slot as EquipmentSlotId] === item.id)
          );
          const unequipped = applyFilters(
            discovered.filter((item) => equippedBySlot[item.eq_slot as EquipmentSlotId] !== item.id)
          );

          const renderIconGrid = (itemList: typeof discovered) => (
            <div className="flex flex-wrap gap-2">
              {itemList.map((item) => {
                const isMenuOpen = menuItemId === item.id;
                return (
                  <div key={item.id} className="relative" data-inventory-menu>
                    <button
                      type="button"
                      onClick={() => setMenuItemId(isMenuOpen ? null : item.id)}
                      className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-white transition-colors hover:border-gray-300"
                    >
                      <SpriteIcon positions={item.sprite_positions!} size={48} />
                    </button>
                    {isMenuOpen && (
                      <div
                        className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[120px] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                        data-inventory-menu
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleEquipItem(item.id, item.eq_slot as EquipmentSlotId);
                            setMenuItemId(null);
                          }}
                          className="flex w-full items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {equippedBySlot[item.eq_slot as EquipmentSlotId] === item.id ? 'Unequip' : 'Equip'}
                        </button>
                        <div className="border-t border-gray-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setDetailItemId(item.id);
                            setMenuItemId(null);
                          }}
                          className="flex w-full items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Details
                        </button>
                        <div className="border-t border-gray-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setCompareItemId(item.id);
                            setCompareItemBId(null);
                            setMenuItemId(null);
                          }}
                          className="flex w-full items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Compare
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );

          return (
            <>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Inventory</h3>
                <div className="flex items-center gap-1.5">
                  {invSlotOptions.length > 1 && (
                    <FilterDropdown
                      label="Slot"
                      options={invSlotOptions}
                      selected={invSlotFilter}
                      onToggle={toggleSlot}
                      onToggleAll={() => setInvSlotFilter(null)}
                      formatOption={(s) => s.replace('slot-', '')}
                    />
                  )}
                  {invBuffKindOptions.length > 0 && (
                    <FilterDropdown
                      label="Buffs"
                      options={invBuffKindOptions}
                      selected={invBuffFilter}
                      onToggle={toggleBuff}
                      onToggleAll={() => setInvBuffFilter(null)}
                      formatOption={formatBuffKind}
                    />
                  )}
                </div>
              </div>
              {discovered.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">Brak przedmiotów.</p>
              ) : (
                <>
                  {equipped.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium text-gray-500">Equipped</p>
                      {renderIconGrid(equipped)}
                    </div>
                  )}
                  {unequipped.length > 0 && (
                    <div className={equipped.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : 'mt-3'}>
                      {equipped.length > 0 && (
                        <p className="mb-2 text-xs font-medium text-gray-500">Bag</p>
                      )}
                      {renderIconGrid(unequipped)}
                    </div>
                  )}
                  {equipped.length === 0 && unequipped.length === 0 && (
                    <p className="mt-3 text-sm text-gray-400">Brak wyników dla wybranych filtrów.</p>
                  )}
                </>
              )}
            </>
          );
        })()}
      </section>

      {/* Workout log */}
      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Ostatnie 10 workoutów</h3>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">Ładowanie logu...</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Brak workoutów jeszcze.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.key}>
                <Link
                  href={`/rpg/workout/${event.workoutId}`}
                  className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 flex items-start gap-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.planName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-gray-600">{event.gainedXp} Exp</span>
                      {event.xpRates.total > 100 && (
                        <span className={kindBuffBadgeClassName('total')}>
                          ×{(event.xpRates.total / 100).toFixed(1)} total
                        </span>
                      )}
                      {KIND_ORDER.filter((k) => event.xpRates[k] > 100).map((k) => (
                        <span key={k} className={kindBuffBadgeClassName(k)}>
                          ×{(event.xpRates[k] / 100).toFixed(1)} {getExerciseKindTitle(k)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{formatEventDate(event.timestamp)}</p>
                  </div>
                  <div className="shrink-0">
                    {event.levelUpLabel ? (
                      <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        {event.levelUpLabel}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-400">
                        -
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
