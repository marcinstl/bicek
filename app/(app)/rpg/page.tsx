'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
import type { ExerciseKind, RpgRequirement } from '@/lib/types';
import { getExerciseKindTitle } from '@/lib/exercise-stats';

type RpgEvent = {
  key: string;
  workoutId: string;
  timestamp: string;
  workoutTimeMs: number;
  planName: string;
  gainedXp: number;
  levelUpLabel: string | null;
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
  { id: 'slot-armor', row: 1, col: 3 },
  { id: 'slot-weapon', row: 2, col: 1 },
  { id: 'slot-chest', row: 2, col: 2 },
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

  const discoverTriggered = useRef(false);
  const dataReady = !itemsLoading && !discoveriesLoading && !historyLoading && !(workoutIds.length > 0 && setsLoading);

  useEffect(() => {
    if (!dataReady) return;
    if (discoverTriggered.current) return;
    discoverTriggered.current = true;
    void tryDiscoverItems().then((newIds) => {
      if (newIds.length > 0) {
        void queryClient.invalidateQueries({ queryKey: rpgKeys.discoveries() });
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

  const itemIdByFileName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const fileName = item.icon_path.split('/').pop();
      if (fileName) map.set(fileName, item.id);
    }
    return map;
  }, [items]);

  const remoteEquippedBySlot = useMemo<EquippedBySlot>(() => {
    const mapped: EquippedBySlot = {};
    for (const row of equipmentRows) {
      const slot = row.slot as EquipmentSlotId;
      if (!EQUIPMENT_SLOTS.some((s) => s.id === slot)) continue;
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

    setMigrationAttempted(true);
    void (async () => {
      for (const [slot, fileName] of localEntries) {
        const itemId = itemIdByFileName.get(fileName);
        if (!itemId) continue;
        const item = itemById.get(itemId);
        if (!item) continue;
        if (item.eq_slot !== slot) continue;
        await equipMutation.mutateAsync({ slot, item_id: itemId });
      }
      window.localStorage.setItem(EQUIPMENT_MIGRATION_KEY, 'true');
    })();
  }, [
    equipMutation,
    equipmentHydrated,
    hasRemoteEquipment,
    itemById,
    itemIdByFileName,
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
      void unequipMutation.mutateAsync(eqSlot);
      return;
    }
    void equipMutation.mutateAsync({ slot: eqSlot, item_id: itemId });
  };

  const totalXp = useMemo(() => {
    return sets.reduce((sum, set) => {
      if (set.xp != null) return sum + set.xp;
      return sum + computeSetXp(set.exercises.kind, set);
    }, 0);
  }, [sets]);

  const kindTotals = useMemo(() => {
    const totals: Record<ExerciseKind, number> = {
      weighted_reps: 0,
      bodyweight_reps: 0,
      time_based: 0,
      distance_per_time: 0,
    };
    for (const set of sets) {
      const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
      totals[set.exercises.kind] += xp;
    }
    return totals;
  }, [sets]);


  const progress = getLevelProgress(totalXp);
  const loading =
    historyLoading ||
    (workoutIds.length > 0 && setsLoading) ||
    itemsLoading ||
    discoveriesLoading ||
    equipmentLoading;
  const events = useMemo<RpgEvent[]>(() => {
    if (loading) return [];

    const setsByWorkout = new Map<string, typeof sets>();
    for (const set of sets) {
      const arr = setsByWorkout.get(set.workout_id);
      if (arr) arr.push(set);
      else setsByWorkout.set(set.workout_id, [set]);
    }

    const ordered = [...history].sort((a, b) => {
      const aMs = new Date(a.ended_at ?? a.started_at).getTime();
      const bMs = new Date(b.ended_at ?? b.started_at).getTime();
      return bMs - aMs;
    });
    const workoutEvents: RpgEvent[] = [];
    let cumulativeXp = totalXp;

    for (const workout of ordered) {
      const afterLevel = getLevelProgress(cumulativeXp).level;
      const workoutSets = setsByWorkout.get(workout.id) ?? [];
      const byKind: Record<ExerciseKind, number> = {
        weighted_reps: 0,
        bodyweight_reps: 0,
        time_based: 0,
        distance_per_time: 0,
      };

      for (const set of workoutSets) {
        const xp = set.xp ?? computeSetXp(set.exercises.kind, set);
        byKind[set.exercises.kind] += xp;
      }

      const workoutXp = Object.values(byKind).reduce((sum, n) => sum + n, 0);
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
      });
    }

    return workoutEvents
      .sort((a, b) => {
        if (b.workoutTimeMs !== a.workoutTimeMs) return b.workoutTimeMs - a.workoutTimeMs;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 10);
  }, [history, loading, sets, totalXp]);

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
                    const src = item ? `/${item.icon_path}` : '';
                    if (!src) return null;
                    return (
                      <Image
                        src={src}
                        alt={item?.id ?? itemId}
                        width={48}
                        height={48}
                        className="h-12 w-12 pixel-art"
                      />
                    );
                  })() : null}
                </div>

              ))}
            </div>
          </div>
        </div>
      </div>

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
                    <p className="mt-0.5 text-xs text-gray-600">{event.gainedXp} Exp</p>
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

      <section className="mt-4 rounded-2xl border border-gray-100/90 bg-white/85 backdrop-blur-sm shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Pixel Art Items</h3>
        {(() => {
          const discoveryByItemId = new Map(discoveries.map((d) => [d.item_id, d]));
          const discovered = items
            .filter((item) => discoveredItemIds.has(item.id))
            .sort((a, b) => {
              const da = discoveryByItemId.get(a.id)?.discovered_at ?? '';
              const db = discoveryByItemId.get(b.id)?.discovered_at ?? '';
              return db.localeCompare(da);
            });
          const undiscovered = items.filter((item) => !discoveredItemIds.has(item.id));

          const renderItem = (item: typeof items[number]) => {
            const isEquipped = equippedBySlot[item.eq_slot as EquipmentSlotId] === item.id;
            const isDiscovered = discoveredItemIds.has(item.id);
            const src = `/${item.icon_path}`;
            const reqs = item.requirements ?? [];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleEquipItem(item.id, item.eq_slot as EquipmentSlotId)}
                disabled={!isDiscovered}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isEquipped
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isDiscovered ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <div className="shrink-0">
                  <Image
                    src={src}
                  alt={item.name ?? '???'}
                  width={56}
                  height={56}
                  className={`h-14 w-14 pixel-art ${isDiscovered ? '' : 'brightness-0'}`}
                />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${item.name ? 'text-gray-900' : 'text-gray-400'}`}>
                    {item.name ?? '???'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.item_type ?? '—'} · {item.eq_slot}
                  </p>
                  {reqs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {reqs.map((req, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200"
                        >
                          {formatRequirement(req)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isEquipped && (
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-600">
                    Equipped
                  </span>
                )}
              </button>
            );
          };

          return (
            <>
              {discovered.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-gray-500">Odkryte ({discovered.length})</p>
                  <div className="flex flex-col gap-1.5">{discovered.map(renderItem)}</div>
                </div>
              )}
              {undiscovered.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-gray-400">Nieodkryte ({undiscovered.length})</p>
                  <div className="flex flex-col gap-1.5">{undiscovered.map(renderItem)}</div>
                </div>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
}
