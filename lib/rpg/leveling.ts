const TIBIA_XP_COEFFICIENT = 50 / 3;

function toSafeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Total cumulative XP required to reach a given level.
 * Level 1 starts at 0 XP and there is no level cap.
 */
export function xpForLevel(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  const xp =
    TIBIA_XP_COEFFICIENT * (lvl ** 3 - 6 * lvl ** 2 + 17 * lvl - 12);
  return toSafeNonNegativeInt(xp);
}

/**
 * XP required to go from level-1 to level.
 */
export function xpStepForLevel(level: number): number {
  const lvl = Math.max(2, Math.floor(level));
  return toSafeNonNegativeInt(50 * (lvl ** 2 - 5 * lvl + 8));
}

/**
 * XP required to advance from the current level to the next one.
 */
export function xpToNextLevel(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  return xpForLevel(lvl + 1) - xpForLevel(lvl);
}

/**
 * Finds the highest level that can be reached with given XP.
 * Uses exponential expansion + binary search (no arbitrary level cap).
 */
export function levelFromXp(totalXp: number): number {
  const xp = toSafeNonNegativeInt(totalXp);
  if (xp < xpForLevel(2)) return 1;

  let low = 1;
  let high = 2;

  while (xpForLevel(high) <= xp) {
    low = high;
    high *= 2;
  }

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (xpForLevel(mid) <= xp) low = mid;
    else high = mid;
  }

  return low;
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPct: number;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = toSafeNonNegativeInt(totalXp);
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXp;
  const xpToNextLevel = nextLevelXp - xp;
  const levelSpan = nextLevelXp - currentLevelXp;
  const progressPct = levelSpan > 0 ? Math.min(100, Math.max(0, (xpIntoLevel / levelSpan) * 100)) : 0;

  return {
    level,
    totalXp: xp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNextLevel,
    progressPct,
  };
}
