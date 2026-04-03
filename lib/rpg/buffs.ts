import type { ExerciseKind, RpgItemBuff, XpRates } from '@/lib/types';

export function computeXpRates(
  equippedItems: { buffs?: RpgItemBuff[] | null }[],
): XpRates {
  const rates: XpRates = {
    weighted_reps: 100,
    bodyweight_reps: 100,
    time_based: 100,
    distance_per_time: 100,
    total: 100,
  };

  for (const item of equippedItems) {
    for (const buff of item.buffs ?? []) {
      if (buff.type !== 'xp_rate') continue;
      const key = buff.kind ?? 'total';
      rates[key as keyof XpRates] += buff.value;
    }
  }

  return rates;
}

/**
 * Total XP for overall level: apply only the `total` rate to the raw kind sum.
 * Per-kind rates are intentionally NOT included here — they only affect
 * per-kind levels, not the overall level.
 */
export function applyXpRates(
  kindTotals: Record<ExerciseKind, number>,
  rates: XpRates,
): number {
  const baseSum = (Object.keys(kindTotals) as ExerciseKind[]).reduce(
    (s, k) => s + kindTotals[k],
    0,
  );
  return Math.floor((baseSum * rates.total) / 100);
}

/**
 * Effective XP for a single kind (for per-kind level display).
 * Applies only the kind-specific rate.
 */
export function applyKindRate(baseXp: number, rate: number): number {
  return Math.floor((baseXp * rate) / 100);
}
