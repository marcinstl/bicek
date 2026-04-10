import type { RpgRarity } from '@/lib/types';

/** Fragments gained when trading away one item of this rarity. */
export const TRADE_REWARDS: Record<RpgRarity, Partial<Record<RpgRarity, number>>> = {
  common: { common: 1 },
  uncommon: { uncommon: 1, common: 2 },
  rare: { rare: 1, uncommon: 2, common: 3 },
  epic: { epic: 1, rare: 2, uncommon: 3, common: 4 },
  legendary: { legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 },
};

export type FragmentColumn =
  | 'fragments_common'
  | 'fragments_uncommon'
  | 'fragments_rare'
  | 'fragments_epic'
  | 'fragments_legendary';

export const FRAGMENT_DB_COLUMN: Record<RpgRarity, FragmentColumn> = {
  common: 'fragments_common',
  uncommon: 'fragments_uncommon',
  rare: 'fragments_rare',
  epic: 'fragments_epic',
  legendary: 'fragments_legendary',
};

const DISPLAY_ORDER: RpgRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

export function normalizeItemRarity(r: RpgRarity | undefined | null): RpgRarity {
  return r ?? 'common';
}

/** Non-zero reward lines for UI (highest tier first). */
export function tradeRewardLines(itemRarity: RpgRarity): { tier: RpgRarity; count: number }[] {
  const raw = TRADE_REWARDS[itemRarity];
  return DISPLAY_ORDER.filter((t) => (raw[t] ?? 0) > 0).map((t) => ({ tier: t, count: raw[t]! }));
}

/** Sum fragment payouts from selling `countsByRarity[r]` copies of each rarity (same rules as single trade, stacked). */
export function totalFragmentsFromTrades(countsByRarity: Partial<Record<RpgRarity, number>>): Record<RpgRarity, number> {
  const out: Record<RpgRarity, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  for (const [rarity, n] of Object.entries(countsByRarity) as [RpgRarity, number][]) {
    if (n <= 0) continue;
    const raw = TRADE_REWARDS[rarity];
    for (const t of DISPLAY_ORDER) {
      const c = raw[t];
      if (c && c > 0) out[t] += c * n;
    }
  }
  return out;
}

/** Non-zero totals as UI lines (highest tier first). */
export function fragmentTotalsToLines(totals: Record<RpgRarity, number>): { tier: RpgRarity; count: number }[] {
  return DISPLAY_ORDER.filter((t) => totals[t] > 0).map((t) => ({ tier: t, count: totals[t] }));
}
