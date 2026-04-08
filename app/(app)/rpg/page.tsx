'use client';

import { SpriteIcon } from '@/components/SpriteIcon';
import {
  useActiveHunt,
  useCollectHunt,
  useEquipRpgItem,
  useHuntPoints,
  useRpgInventory,
  useRpgItems,
  useStartHunt,
  useUnequipRpgItem,
} from '@/hooks/useRpgInventory';
import { useSetsForWorkouts, useWorkoutHistory } from '@/hooks/useWorkout';
import { getExerciseKindTitle, kindBuffBadgeClassName } from '@/lib/exercise-stats';
import { applyKindRate, applyXpRates } from '@/lib/rpg/buffs';
import { HUNT_CONFIGS, RARITY_LABELS, RARITY_LOOT_PREVIEW } from '@/lib/rpg/hunts';
import { getLevelProgress } from '@/lib/rpg/leveling';
import { checkRequirements } from '@/lib/rpg/requirements';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind, RpgRarity, RpgRequirement, XpRates } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const HUNT_RARITY_STYLES: Record<RpgRarity, { border: string; bg: string; fill: string; text: string; badge: string }> = {
  common:    { border: 'border-gray-300',   bg: 'bg-gray-100',   fill: 'bg-gray-400',   text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-600 ring-gray-200' },
  uncommon:  { border: 'border-green-400',  bg: 'bg-green-50',   fill: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-50 text-green-700 ring-green-200' },
  rare:      { border: 'border-blue-400',   bg: 'bg-blue-50',    fill: 'bg-blue-500',   text: 'text-blue-700',   badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  epic:      { border: 'border-purple-400', bg: 'bg-purple-50',  fill: 'bg-purple-500', text: 'text-purple-700', badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-50',  fill: 'bg-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
};

const RARITY_TINT_HEX: Record<RpgRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

const HUNT_MODAL_SPRITE_BY_RARITY: Record<RpgRarity, { col: number; row: number }> = {
  common: { col: 0, row: 42 },
  uncommon: { col: 1, row: 42 },
  rare: { col: 2, row: 42 },
  epic: { col: 3, row: 42 },
  legendary: { col: 4, row: 42 },
};

const RARITY_SORT_INDEX: Record<RpgRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${hms}` : hms;
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
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory();
  const workoutIds = useMemo(() => history.map((w) => w.id), [history]);
  const { data: sets = [], isLoading: setsLoading } = useSetsForWorkouts(workoutIds, workoutIds.length > 0);
  const { data: items = [] } = useRpgItems();
  const { data: inventoryRows = [] } = useRpgInventory();
  const { data: activeHunt } = useActiveHunt();
  const { data: huntPoints } = useHuntPoints();
  const equipMutation = useEquipRpgItem();
  const unequipMutation = useUnequipRpgItem();
  const startHuntMutation = useStartHunt();
  const collectHuntMutation = useCollectHunt();

  const [showTotalExp, setShowTotalExp] = useState(true);
  const [menuRowId, setMenuRowId] = useState<string | null>(null); // inventory row id
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [invSlotFilter, setInvSlotFilter] = useState<Set<string> | null>(null);
  const [invBuffFilter, setInvBuffFilter] = useState<Set<string> | null>(null);
  const [invRarityFilter, setInvRarityFilter] = useState<Set<string> | null>(null);
  const [compareItemId, setCompareItemId] = useState<string | null>(null);
  const [compareItemBId, setCompareItemBId] = useState<string | null>(null);

  // Hunt UI state
  const [huntModalOpen, setHuntModalOpen] = useState(false);
  const [selectedHuntRarity, setSelectedHuntRarity] = useState<RpgRarity | null>(null);
  const [rewardItems, setRewardItems] = useState<{ id: string; name: string; rarity: RpgRarity; sprite_positions: import('@/lib/types').SpritePosition[] | null }[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeHunt || activeHunt.collected_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeHunt]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);

  // Items the user owns (in inventory, equipped or not)
  const ownedItemIds = useMemo(() => new Set(inventoryRows.map((r) => r.item_id)), [inventoryRows]);

  // equippedBySlot — derived from inventory rows where equipped=true
  const equippedBySlot = useMemo<EquippedBySlot>(() => {
    const mapped: EquippedBySlot = {};
    for (const row of inventoryRows) {
      if (!row.equipped) continue;
      const slot = row.item?.eq_slot as EquipmentSlotId | undefined;
      if (!slot || !EQUIPMENT_SLOTS.some((s) => s.id === slot)) continue;
      mapped[slot] = row.item?.id;
    }
    return mapped;
  }, [inventoryRows]);

  const invSlotOptions = useMemo(
    () => [...new Set(items.filter((i) => ownedItemIds.has(i.id)).map((i) => i.eq_slot))].sort(),
    [items, ownedItemIds],
  );
  const invBuffKindOptions = useMemo(() => {
    const kinds = new Set<string>();
    let hasNoBuff = false;
    for (const item of items) {
      if (!ownedItemIds.has(item.id)) continue;
      const buffs = item.buffs ?? [];
      if (buffs.length === 0) { hasNoBuff = true; continue; }
      for (const b of buffs) kinds.add(b.kind ?? 'total');
    }
    return [...(hasNoBuff ? ['—'] : []), ...[...kinds].sort()];
  }, [items, ownedItemIds]);

  const RARITY_ORDER_FILTER: RpgRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const invRarityOptions = useMemo(
    () => RARITY_ORDER_FILTER.filter((r) =>
      items.some((i) => ownedItemIds.has(i.id) && i.rarity === r)
    ),
    [items, ownedItemIds],
  );

  useEffect(() => {
    if (!menuRowId) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-inventory-menu]')) {
        setMenuRowId(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuRowId]);

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

  const canEquipItem = useCallback((itemId: string) => {
    const item = itemById.get(itemId);
    if (!item) return false;
    return checkRequirements(item.requirements, {
      totalXp,
      kindTotals,
      workoutCount: history.length,
    });
  }, [itemById, totalXp, kindTotals, history.length]);

  const handleEquipItem = useCallback((itemId: string, eqSlot: EquipmentSlotId) => {
    if (!ownedItemIds.has(itemId)) return;
    const item = itemById.get(itemId);
    if (!item || item.eq_slot !== eqSlot) return;
    if (!canEquipItem(itemId)) return;
    if (equippedBySlot[eqSlot] === itemId) {
      void unequipMutation.mutateAsync(itemId);
    } else {
      void equipMutation.mutateAsync({ item_id: itemId });
    }
  }, [ownedItemIds, itemById, canEquipItem, equippedBySlot, unequipMutation, equipMutation]);


  const progress = getLevelProgress(totalXp);
  const loading =
    historyLoading ||
    (workoutIds.length > 0 && setsLoading);
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

            {/* Hunt Points — below skill bars */}
            {huntPoints != null && (
              <div className="mt-5 max-w-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Hunt Points</span>
                  <span className="text-xs font-medium tabular-nums text-gray-700">
                    {huntPoints.hunt_points % 1 === 0
                      ? huntPoints.hunt_points
                      : huntPoints.hunt_points.toFixed(1)}
                    <span className="ml-1 inline-flex items-center gap-1 font-normal text-gray-400">
                      / {huntPoints.hunt_points_maximum}
                      <SpriteIcon positions={[{ col: 3, row: 47 }]} size={12} />
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, (huntPoints.hunt_points / huntPoints.hunt_points_maximum) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-300/80 bg-slate-900/5 p-3 flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 self-start">Equipment</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 56px)', gridTemplateRows: 'repeat(4, 56px)' }}>
              {EQUIPMENT_SLOTS.map((slot) => {
                const itemId = equippedBySlot[slot.id];
                const item = itemId ? itemById.get(itemId) : undefined;
                const rarityStyles = item?.rarity ? HUNT_RARITY_STYLES[item.rarity] : null;
                return (
                  <div
                    key={slot.id}
                    className={`flex h-14 w-14 items-center justify-center rounded-md border transition-colors ${
                      rarityStyles
                        ? `${rarityStyles.border} ${rarityStyles.bg}`
                        : 'border-gray-300 bg-gray-50'
                    }`}
                    style={{ gridColumnStart: slot.col, gridRowStart: slot.row }}
                  >
                    {item?.sprite_positions?.length ? (
                      <SpriteIcon positions={item.sprite_positions} size={48} />
                    ) : null}
                  </div>
                );
              })}
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

      {/* ── Hunt section ── */}
      {(() => {
        // Compute hunt progress
        const huntDoneMs = activeHunt
          ? new Date(activeHunt.started_at).getTime() + activeHunt.duration_hours * 3_600_000
          : 0;
        const isHuntDone = activeHunt ? now >= huntDoneMs : false;
        const huntPct = activeHunt
          ? Math.min(100, ((now - new Date(activeHunt.started_at).getTime()) / (activeHunt.duration_hours * 3_600_000)) * 100)
          : 0;
        const huntRemaining = activeHunt && !isHuntDone ? formatCountdown(huntDoneMs - now) : null;
        const huntConfig = HUNT_CONFIGS.find((c) => c.rarity === activeHunt?.rarity);
        const huntStyles = activeHunt ? HUNT_RARITY_STYLES[activeHunt.rarity] : null;

        return (
          <div className="mt-4">
            {activeHunt ? (
              // Active hunt — progress bar button
              <div>
                <div className="relative h-10 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  {/* Fill */}
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-1000 ${huntStyles?.fill ?? 'bg-gray-400'}`}
                    style={{ width: `${huntPct}%` }}
                  />
                  {/* Label */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2">
                    <span className="text-xs font-semibold text-gray-800 drop-shadow-sm">
                      {huntConfig?.name} — {Math.round(huntPct)}%
                    </span>
                    {isHuntDone && (
                      <button
                        type="button"
                        disabled={collectHuntMutation.isPending}
                        onClick={() => {
                          void collectHuntMutation.mutateAsync().then((data) => {
                            const rewarded = (data.items as { id: string; name: string; rarity: string; sprite_positions: import('@/lib/types').SpritePosition[] | null }[])
                              .map((i) => ({ ...i, rarity: (i.rarity ?? 'common') as RpgRarity }));
                            setRewardItems(rewarded);
                          });
                        }}
                        className={`rounded-lg px-3 py-1 text-xs font-bold text-white shadow ${huntStyles?.fill ?? 'bg-gray-500'} hover:opacity-90 transition-opacity`}
                      >
                        {collectHuntMutation.isPending ? '…' : 'Collect!'}
                      </button>
                    )}
                  </div>
                </div>
                {huntRemaining && (
                  <p className="mt-1 text-center text-[11px] text-gray-500 tabular-nums">{huntRemaining}</p>
                )}
                {isHuntDone && !collectHuntMutation.isPending && (
                  <p className="mt-1 text-center text-[11px] font-semibold text-green-600">Hunt zakończony! Kliknij Collect!</p>
                )}
              </div>
            ) : (
              // No active hunt — Hunt button
              <div>
                <button
                  type="button"
                  disabled={(huntPoints?.hunt_points ?? 50) < 50}
                  onClick={() => setHuntModalOpen(true)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={(huntPoints?.hunt_points ?? 50) < 50 ? 'Potrzebujesz co najmniej 50 Hunt Points' : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <SpriteIcon positions={[{ col: 3, row: 47 }]} size={16} />
                    Hunt
                  </span>
                </button>
              </div>
            )}

            {/* Hunt picker modal */}
            {huntModalOpen && !activeHunt && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900">Wybierz wyprawę</h2>
                    {huntPoints != null && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <SpriteIcon positions={[{ col: 3, row: 47 }]} size={16} />
                        <span className="font-semibold text-gray-700 tabular-nums">
                          {huntPoints.hunt_points % 1 === 0 ? huntPoints.hunt_points : huntPoints.hunt_points.toFixed(1)}
                        </span>
                        {' / '}{huntPoints.hunt_points_maximum} HP
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {HUNT_CONFIGS.map((cfg) => {
                      const styles = HUNT_RARITY_STYLES[cfg.rarity];
                      const isSelected = selectedHuntRarity === cfg.rarity;
                      const canAfford = (huntPoints?.hunt_points ?? 0) >= cfg.hunt_cost;
                      return (
                        <button
                          key={cfg.rarity}
                          type="button"
                          disabled={!canAfford}
                          onClick={() => setSelectedHuntRarity(cfg.rarity)}
                          className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${styles.border} ${isSelected ? `${styles.bg} ring-1 ring-inset ${styles.border}` : canAfford ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-50 cursor-not-allowed'}`}
                        >
                          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${styles.border} ${styles.bg}`}>
                            <SpriteIcon
                              positions={[HUNT_MODAL_SPRITE_BY_RARITY[cfg.rarity]]}
                              size={30}
                              tintColor={RARITY_TINT_HEX[cfg.rarity]}
                              tintOpacity={0.78}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{cfg.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles.badge}`}>
                                {RARITY_LABELS[cfg.rarity]}
                              </span>
                              <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ${canAfford ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                                <span className="inline-flex items-center gap-1">
                                  {cfg.hunt_cost}
                                  <SpriteIcon positions={[{ col: 3, row: 47 }]} size={12} />
                                </span>
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {cfg.duration_hours >= 24
                                ? `${cfg.duration_hours / 24}d`
                                : cfg.duration_hours < 1
                                  ? `${cfg.duration_hours * 60} min`
                                  : `${cfg.duration_hours}h`}
                              {' · '}
                              {cfg.item_count_min === cfg.item_count_max
                                ? `${cfg.item_count_min} item`
                                : `${cfg.item_count_min}–${cfg.item_count_max} items`}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{RARITY_LOOT_PREVIEW[cfg.rarity]}</p>
                          </div>
                          {isSelected && (
                            <svg className={`mt-0.5 h-4 w-4 shrink-0 ${styles.text}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setHuntModalOpen(false); setSelectedHuntRarity(null); }}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      disabled={!selectedHuntRarity || startHuntMutation.isPending || (selectedHuntRarity != null && (huntPoints?.hunt_points ?? 0) < (HUNT_CONFIGS.find((c) => c.rarity === selectedHuntRarity)?.hunt_cost ?? 0))}
                      onClick={() => {
                        if (!selectedHuntRarity) return;
                        void startHuntMutation.mutateAsync(selectedHuntRarity).then(() => {
                          setHuntModalOpen(false);
                          setSelectedHuntRarity(null);
                        });
                      }}
                      className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {startHuntMutation.isPending ? '…' : 'Start'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reward modal */}
            {rewardItems && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                  <h2 className="mb-4 text-base font-bold text-gray-900">🎉 Zdobyte przedmioty!</h2>
                  {rewardItems.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-4">Brak łupów.</p>
                  ) : (
                    <div className="flex flex-col gap-2 mb-4">
                      {rewardItems.map((item, idx) => {
                        const styles = HUNT_RARITY_STYLES[item.rarity];
                        return (
                          <div key={idx} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${styles.border} ${styles.bg}`}>
                            {item.sprite_positions && item.sprite_positions.length > 0 ? (
                              <SpriteIcon positions={item.sprite_positions} size={40} />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-100" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                              <span className={`text-[10px] font-semibold ${styles.text}`}>{RARITY_LABELS[item.rarity]}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setRewardItems(null)}
                    className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Inventory */}
      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        {(() => {
          // One entry per inventory row (duplicates show as separate icons)
          type InvEntry = { row: (typeof inventoryRows)[number]; item: (typeof items)[number] };
          const inventoryEntries: InvEntry[] = inventoryRows
            .map((row) => ({ row, item: itemById.get(row.item_id) }))
            .filter((e): e is InvEntry => e.item != null)
            .sort((a, b) => {
              const aRank =
                a.item.rarity != null ? (RARITY_SORT_INDEX[a.item.rarity] ?? -1) : -1;
              const bRank =
                b.item.rarity != null ? (RARITY_SORT_INDEX[b.item.rarity] ?? -1) : -1;
              if (aRank !== bRank) return aRank - bRank;
              return b.row.equipped_at.localeCompare(a.row.equipped_at);
            });

          // Still needed for detail/compare lookup (unique items by id)
          const discovered = items.filter((item) => ownedItemIds.has(item.id));

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
                          const isLeft = item.id === compareItem.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={isLeft}
                              onClick={() => { if (!isLeft) setCompareItemBId(item.id); }}
                              className={`flex h-14 w-14 items-center justify-center rounded-xl border transition-colors ${
                                isLeft
                                  ? 'border-blue-300 bg-blue-100 opacity-40 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <SpriteIcon positions={item.sprite_positions!} size={48} />
                            </button>
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
            const canEquipDetail = canEquipItem(detailItem.id);
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
                      disabled={!isEquipped && !canEquipDetail}
                      title={!isEquipped && !canEquipDetail ? 'Nie spelniono wymagan przedmiotu' : undefined}
                      className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          const toggleRarity = (opt: string) => {
            setInvRarityFilter((prev) => {
              const cur = prev ?? new Set(invRarityOptions);
              const next = new Set(cur);
              if (next.has(opt)) next.delete(opt); else next.add(opt);
              if (next.size === 0) return new Set([opt]);
              return next.size === invRarityOptions.length ? null : next;
            });
          };
          const formatBuffKind = (k: string) => {
            if (k === '—') return 'No buff';
            if (k === 'total') return 'Global XP';
            try { return getExerciseKindTitle(k as ExerciseKind); } catch { return k; }
          };
          const formatRarity = (r: string) =>
            r.charAt(0).toUpperCase() + r.slice(1);

          const applyFilters = (list: InvEntry[]) =>
            list.filter(({ item }) => {
              if (invSlotFilter !== null && !invSlotFilter.has(item.eq_slot)) return false;
              if (invRarityFilter !== null && item.rarity && !invRarityFilter.has(item.rarity)) return false;
              if (invBuffFilter !== null) {
                const kinds = (item.buffs ?? []).map((b) => b.kind ?? 'total');
                if (kinds.length === 0) return invBuffFilter.has('—');
                return kinds.some((k) => invBuffFilter.has(k));
              }
              return true;
            });

          const equippedEntries = applyFilters(inventoryEntries.filter((e) => e.row.equipped));
          const unequippedEntries = applyFilters(inventoryEntries.filter((e) => !e.row.equipped));

          const renderIconGrid = (entryList: InvEntry[]) => (
            <div className="flex flex-wrap gap-2">
              {entryList.map(({ row, item }) => {
                const isMenuOpen = menuRowId === row.id;
                const rarityStyles = item.rarity ? HUNT_RARITY_STYLES[item.rarity] : null;
                const isSameItemAlreadyEquipped = Object.values(equippedBySlot).some((equippedId) => equippedId === item.id);
                const canEquipFromReq = canEquipItem(item.id);
                const canEquipFromMenu = !row.equipped && !isSameItemAlreadyEquipped && canEquipFromReq;
                const isRequirementLocked = !row.equipped && !canEquipFromReq;
                return (
                  <div key={row.id} className="relative" data-inventory-menu>
                    <button
                      type="button"
                      onClick={() => setMenuRowId(isMenuOpen ? null : row.id)}
                      className={`relative flex h-14 w-14 items-center justify-center rounded-xl border transition-colors ${rarityStyles ? `${rarityStyles.border} ${rarityStyles.bg}` : 'border-gray-200 bg-white hover:border-gray-300'} ${isRequirementLocked ? 'opacity-35 saturate-50' : ''}`}
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
                            if (row.equipped) {
                              void unequipMutation.mutateAsync(row.item_id);
                            } else if (canEquipFromMenu) {
                              void equipMutation.mutateAsync({ item_id: row.item_id });
                            }
                            setMenuRowId(null);
                          }}
                          disabled={!row.equipped && !canEquipFromMenu}
                          title={
                            !row.equipped && isSameItemAlreadyEquipped
                              ? 'Ten przedmiot jest juz zalozony'
                              : !row.equipped && !canEquipFromReq
                                ? 'Nie spelniono wymagan przedmiotu'
                                : undefined
                          }
                          className="flex w-full items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {row.equipped ? 'Unequip' : isSameItemAlreadyEquipped ? 'Equipped' : !canEquipFromReq ? 'Locked' : 'Equip'}
                        </button>
                        <div className="border-t border-gray-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setDetailItemId(item.id);
                            setMenuRowId(null);
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
                            setMenuRowId(null);
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
                  {invRarityOptions.length > 0 && (
                    <FilterDropdown
                      label="Rarity"
                      options={invRarityOptions}
                      selected={invRarityFilter}
                      onToggle={toggleRarity}
                      onToggleAll={() => setInvRarityFilter(null)}
                      formatOption={formatRarity}
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
                  {equippedEntries.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium text-gray-500">Equipped</p>
                      {renderIconGrid(equippedEntries)}
                    </div>
                  )}
                  {unequippedEntries.length > 0 && (
                    <div className={equippedEntries.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : 'mt-3'}>
                      {equippedEntries.length > 0 && (
                        <p className="mb-2 text-xs font-medium text-gray-500">Bag</p>
                      )}
                      {renderIconGrid(unequippedEntries)}
                    </div>
                  )}
                  {equippedEntries.length === 0 && unequippedEntries.length === 0 && (
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
