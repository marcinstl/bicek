/**
 * Level i XP w stylu Tibii – krzywa dla poziomów 1–100.
 * totalXpForLevel(1) = 0; dla L >= 2: 50 * L².
 */

const MIN_RATE = 0.002;
const MAX_RATE = 0.015;

const MULTIPLIER_MIN = 0.5;
const MULTIPLIER_MAX = 5;
const MULTIPLIER_STEP_UP = 0.25;
const MULTIPLIER_STEP_DOWN_SOFT = 0.2;
const MULTIPLIER_STEP_DOWN_HARD = 0.35;

/** Łączna XP potrzebna do wejścia na dany level (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * level;
}

/** Obecny level użytkownika na podstawie sumy XP (min 1). */
export function levelFromTotalXp(totalXp: number): number {
  if (totalXp < 200) return 1;
  return Math.floor(Math.sqrt(totalXp / 50));
}

/** XP potrzebne do wejścia na następny level (do paska postępu). */
export function xpToNextLevel(level: number): number {
  return 50 * (2 * level + 1);
}

/** Base exp za 1 powtórzenie (z levelu użytkownika). Level 1–9 → 1, 10–19 → 2, itd. */
export function baseExpPerRep(userLevel: number): number {
  return 1 + Math.floor(userLevel / 10);
}

/** Multiplier 1x–5x z dailyRate i streak (bez zapisu, nieliniowy streak). Przy streak 0 zwraca 1×. */
export function xpMultiplierFromRateAndStreak(dailyRate: number, streak: number): number {
  if (streak === 0) return 1;
  const rateNorm = (dailyRate - MIN_RATE) / (MAX_RATE - MIN_RATE);
  const streakNorm = 1 - Math.pow(0.9, streak);
  const mult = 1 + 4 * (0.5 * rateNorm + 0.5 * streakNorm);
  return Math.max(1, Math.min(5, mult));
}

/** XP za sesję: completed × basePerRep(level) × multiplier(dailyRate, streak). */
export function xpForSession(
  completed: number,
  userLevel: number,
  dailyRate: number,
  streak: number,
): number {
  if (completed <= 0) return 0;
  const basePerRep = baseExpPerRep(userLevel);
  const mult = xpMultiplierFromRateAndStreak(dailyRate, streak);
  return Math.floor(completed * basePerRep * mult);
}

/** Bazowe XP za ukończony dzień (completed >= target). @deprecated – używaj xpForSession */
export function baseXp(target: number, completed: number): number {
  if (target <= 0 || completed < target) return 0;
  return 10 + Math.floor(target);
}

/** Nowy multiplier po sesji (completed/target). Zakres 0.5–5, zaokrąglenie do 1 miejsca. */
export function nextMultiplier(
  current: number,
  completed: number,
  target: number
): number {
  if (target <= 0) return current;
  const ratio = completed / target;

  let next: number;
  if (ratio >= 1) {
    next = Math.min(current + MULTIPLIER_STEP_UP, MULTIPLIER_MAX);
  } else if (ratio >= 0.85) {
    next = current;
  } else if (ratio >= 0.6) {
    next = Math.max(current - MULTIPLIER_STEP_DOWN_SOFT, MULTIPLIER_MIN);
  } else {
    next = Math.max(current - MULTIPLIER_STEP_DOWN_HARD, MULTIPLIER_MIN);
  }

  return Math.round(next * 10) / 10;
}

/** XP przyznane za sesję: base * multiplier (clamp 0.5–5). */
export function xpGain(base: number, multiplier: number): number {
  const m = Math.max(MULTIPLIER_MIN, Math.min(MULTIPLIER_MAX, multiplier));
  return Math.floor(base * m);
}
