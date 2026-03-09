/**
 * Level i XP w stylu Tibii – krzywa dla poziomów 1–100.
 * totalXpForLevel(1) = 0; dla L >= 2: 50 * L².
 * Multiplier 1–5× z dailyRate i konsystencji z ostatnich logów (bez streak).
 */

import type { DailyLog } from './types';

const MIN_RATE = 0.002;
const MAX_RATE = 0.015;

const CONSISTENCY_WINDOW_DAYS = 14;
const CONSISTENCY_GOAL_RATIO = 0.85;

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

/**
 * Konsystencja 0–1 z ostatnich N dni treningowych (nie rest).
 * Dla każdego dnia: min(1, ratio/0.85); średnia. Brak logów → 0.
 * @param excludeDate – np. today ISO, żeby nie liczyć dzisiejszego logu przy przyznawaniu XP
 */
export function consistencyFromLogs(
  logs: DailyLog[],
  windowDays: number = CONSISTENCY_WINDOW_DAYS,
  referenceDate?: string,
  excludeDate?: string,
): number {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const from = new Date(ref);
  from.setDate(from.getDate() - windowDays);
  const fromStr = from.toISOString().slice(0, 10);
  const contributions: number[] = [];
  for (const log of logs) {
    if (log.isRestDay || log.date < fromStr) continue;
    if (excludeDate && log.date === excludeDate) continue;
    const ratio = log.target > 0 ? log.completed / log.target : 0;
    contributions.push(Math.min(1, ratio / CONSISTENCY_GOAL_RATIO));
  }
  if (contributions.length === 0) return 0;
  return contributions.reduce((a, b) => a + b, 0) / contributions.length;
}

/** Multiplier 1×–5× z dailyRate i konsystencji (0–1). */
export function xpMultiplierFromRateAndConsistency(dailyRate: number, consistency: number): number {
  return xpMultiplierBreakdownFromConsistency(dailyRate, consistency).mult;
}

/** Breakdown do wyświetlenia: mult, rateNorm, consistencyNorm. Zakres mult 1–5. Przy consistency=0 mult=1. */
export function xpMultiplierBreakdownFromConsistency(
  dailyRate: number,
  consistency: number,
): { mult: number; rateNorm: number; consistencyNorm: number } {
  const rateNorm = (dailyRate - MIN_RATE) / (MAX_RATE - MIN_RATE);
  const consistencyNorm = Math.max(0, Math.min(1, consistency));
  const mult = Math.max(1, Math.min(5, 1 + 4 * consistencyNorm * (0.5 + 0.5 * rateNorm)));
  return { mult, rateNorm, consistencyNorm };
}

/** Multiplier 1x–5x z dailyRate i streak (legacy). Przy streak 0 zwraca 1×. */
export function xpMultiplierFromRateAndStreak(dailyRate: number, streak: number): number {
  const c = streak === 0 ? 0 : 1 - Math.pow(0.9, streak);
  return xpMultiplierFromRateAndConsistency(dailyRate, c);
}

/** Breakdown do wyświetlenia (legacy): mult, rateNorm, streakNorm. */
export function xpMultiplierBreakdown(
  dailyRate: number,
  streak: number,
): { mult: number; rateNorm: number; streakNorm: number } {
  const streakNorm = streak === 0 ? 0 : 1 - Math.pow(0.9, streak);
  const out = xpMultiplierBreakdownFromConsistency(dailyRate, streakNorm);
  return { mult: out.mult, rateNorm: out.rateNorm, streakNorm };
}

/** XP za sesję: completed × basePerRep(level) × multiplier(dailyRate, consistency). */
export function xpForSession(
  completed: number,
  userLevel: number,
  dailyRate: number,
  consistencyOrStreak: number,
): number {
  if (completed <= 0) return 0;
  const basePerRep = baseExpPerRep(userLevel);
  const mult = xpMultiplierFromRateAndConsistency(dailyRate, consistencyOrStreak);
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
