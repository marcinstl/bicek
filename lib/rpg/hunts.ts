import type { RpgRarity } from '@/lib/types';

export const HUNT_CONFIGS = [
  {
    rarity: 'common' as RpgRarity,
    name: 'Patrol',
    duration_hours: 0.5,
    item_count_min: 1,
    item_count_max: 1,
  },
  {
    rarity: 'uncommon' as RpgRarity,
    name: 'Ekspedycja',
    duration_hours: 2,
    item_count_min: 1,
    item_count_max: 2,
  },
  {
    rarity: 'rare' as RpgRarity,
    name: 'Poszukiwanie',
    duration_hours: 6,
    item_count_min: 1,
    item_count_max: 3,
  },
  {
    rarity: 'epic' as RpgRarity,
    name: 'Rajd',
    duration_hours: 24,
    item_count_min: 1,
    item_count_max: 5,
  },
  {
    rarity: 'legendary' as RpgRarity,
    name: 'Krucjata',
    duration_hours: 168,
    item_count_min: 1,
    item_count_max: 7,
  },
] as const;

export type HuntConfig = (typeof HUNT_CONFIGS)[number];

export const HUNT_CONFIG_BY_RARITY = Object.fromEntries(
  HUNT_CONFIGS.map((c) => [c.rarity, c]),
) as Record<RpgRarity, HuntConfig>;

// Rarity probability tables per hunt tier.
// Each entry is [rarity, weight].
const RARITY_ORDER: RpgRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

type LootTable = Partial<Record<RpgRarity, number>>;

const LOOT_TABLES: Record<RpgRarity, LootTable> = {
  common:    { common: 95, uncommon: 5 },
  uncommon:  { common: 80, uncommon: 20 },
  rare:      { common: 60, uncommon: 30, rare: 10 },
  epic:      { common: 50, uncommon: 30, rare: 15, epic: 5 },
  legendary: { common: 40, uncommon: 30, rare: 18, epic: 9, legendary: 3 },
};

function rollRarity(huntRarity: RpgRarity): RpgRarity {
  const table = LOOT_TABLES[huntRarity];
  const entries = Object.entries(table) as [RpgRarity, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[0][0];
}

/** Roll item IDs for a hunt from the available pool. Falls back one tier down if a rarity has no items. */
export function rollLoot(
  huntRarity: RpgRarity,
  itemsByRarity: Record<RpgRarity, string[]>,
): string[] {
  const config = HUNT_CONFIG_BY_RARITY[huntRarity];
  const count =
    config.item_count_min === config.item_count_max
      ? config.item_count_min
      : config.item_count_min +
        Math.floor(Math.random() * (config.item_count_max - config.item_count_min + 1));

  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    let rarity = rollRarity(huntRarity);

    // Fall back one tier at a time if this rarity has no items.
    let idx = RARITY_ORDER.indexOf(rarity);
    while (itemsByRarity[rarity].length === 0 && idx > 0) {
      idx--;
      rarity = RARITY_ORDER[idx];
    }

    const pool = itemsByRarity[rarity];
    if (pool.length === 0) continue; // no items at all — skip slot

    results.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return results;
}

export const RARITY_LABELS: Record<RpgRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const RARITY_LOOT_PREVIEW: Record<RpgRarity, string> = {
  common: 'Common, Uncommon',
  uncommon: 'Common, Uncommon',
  rare: 'Common, Uncommon, Rare',
  epic: 'Common → Epic',
  legendary: 'Common → Legendary',
};
