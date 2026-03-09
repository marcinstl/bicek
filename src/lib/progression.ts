import { Exercise, DailyLog } from './types';
import { todayISO } from './utils';

const MIN_RATE = 0.002;
const MAX_RATE = 0.015;

export function frequencyMultiplier(daysPerWeek: number): number {
  const dpw = Math.max(1, Math.min(7, daysPerWeek));
  return Math.sqrt(7 / dpw);
}

export function effectiveRate(dailyRate: number, daysPerWeek: number): number {
  return dailyRate * frequencyMultiplier(daysPerWeek);
}

export function displayTarget(currentTarget: number): number {
  return Math.floor(currentTarget);
}

export function advanceTarget(currentTarget: number, dailyRate: number, daysPerWeek: number = 7): number {
  return currentTarget * (1 + effectiveRate(dailyRate, daysPerWeek));
}

export function adjustDailyRate(dailyRate: number, completed: number, target: number): number {
  if (target === 0) return dailyRate;

  const ratio = completed / target;

  if (ratio >= 1.0) {
    return Math.min(dailyRate + 0.001, MAX_RATE);
  } else if (ratio >= 0.85) {
    return dailyRate;
  } else if (ratio >= 0.60) {
    return Math.max(dailyRate - 0.002, MIN_RATE);
  } else {
    return Math.max(dailyRate - 0.005, MIN_RATE);
  }
}

const CONSISTENCY_STEP = 0.05;

/** Konsystencja 0–1: dobrze (≥0.85) +0.05, średnio (0.6–0.85) bez zmiany, słabo (&lt;0.6) −0.05. */
export function adjustConsistency(consistency: number, completed: number, target: number): number {
  if (target === 0) return consistency;
  const ratio = completed / target;
  const current = Math.max(0, Math.min(1, consistency));
  if (ratio >= 0.85) return Math.min(1, current + CONSISTENCY_STEP);
  if (ratio >= 0.6) return current;
  return Math.max(0, current - CONSISTENCY_STEP);
}

export function shouldRestDay(
  exercise: Exercise,
  recentLogs: DailyLog[],
  effectiveDaysPerWeek?: number
): boolean {
  const dpw = effectiveDaysPerWeek ?? exercise.daysPerWeek ?? 7;
  const trainingLogs = recentLogs.filter(l => !l.isRestDay);

  const lastTrainingDay = trainingLogs.length > 0
    ? trainingLogs[trainingLogs.length - 1]
    : null;
  const prevTrainingDay = trainingLogs.length > 1
    ? trainingLogs[trainingLogs.length - 2]
    : null;

  if (lastTrainingDay && prevTrainingDay) {
    const lastRatio = lastTrainingDay.target > 0
      ? lastTrainingDay.completed / lastTrainingDay.target
      : 1;
    const prevRatio = prevTrainingDay.target > 0
      ? prevTrainingDay.completed / prevTrainingDay.target
      : 1;

    if (lastRatio < 0.85 && prevRatio < 0.85) {
      return true;
    }
  }

  if (dpw >= 5) {
    const consecutiveTrainingDays = countConsecutiveTrainingFromSim(recentLogs);
    if (consecutiveTrainingDays >= 4) {
      return true;
    }
  }

  return false;
}

export interface ForecastDay {
  dayNumber: number;
  target: number;
  isRestDay: boolean;
  isToday: boolean;
}

export function forecastDays(
  exercise: Exercise,
  recentLogs: DailyLog[],
  todayIsRestDay: boolean,
  count: number = 7,
  effectiveDaysPerWeek?: number,
): ForecastDay[] {
  const days: ForecastDay[] = [];
  let rawTarget = exercise.currentTarget;
  const rate = exercise.dailyRate;
  const dpw = effectiveDaysPerWeek ?? exercise.daysPerWeek ?? 7;
  let dayNum = exercise.currentDay;

  const simLogs = [...recentLogs];

  for (let i = 0; i < count; i++) {
    const isFirst = i === 0;
    let isRest: boolean;

    if (isFirst) {
      isRest = todayIsRestDay;
    } else if (dpw >= 5) {
      const consecutiveTraining = countConsecutiveTrainingFromSim(simLogs);
      isRest = consecutiveTraining >= 4;
    } else {
      isRest = false;
    }

    days.push({
      dayNumber: dayNum,
      target: Math.floor(rawTarget),
      isRestDay: isRest,
      isToday: isFirst,
    });

    simLogs.push({
      id: '',
      exerciseId: exercise.id,
      dayNumber: dayNum,
      target: Math.floor(rawTarget),
      completed: isRest ? 0 : Math.floor(rawTarget),
      date: '',
      isRestDay: isRest,
    });

    if (!isRest) {
      rawTarget = rawTarget * (1 + effectiveRate(rate, dpw));
    }
    dayNum++;
  }

  return days;
}

/** Total reps accumulated over a number of calendar days for the AddExercise form preview. */
export function previewTotalReps(startValue: number, daysPerWeek: number, calendarDays: number): number {
  const rate = effectiveRate(0.01, daysPerWeek);
  const sessions = Math.floor(calendarDays * daysPerWeek / 7);
  let target = startValue;
  let total = 0;
  for (let i = 0; i < sessions; i++) {
    total += Math.floor(target);
    target = target * (1 + rate);
  }
  return total;
}

function countConsecutiveTrainingFromSim(logs: DailyLog[]): number {
  let count = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].isRestDay) break;
    count++;
  }
  return count;
}

export function processDay(
  exercise: Exercise,
  completed: number,
  recentLogs: DailyLog[],
  isRestDay: boolean,
  effectiveDaysPerWeek?: number
): { updatedExercise: Partial<Exercise>; log: Omit<DailyLog, 'id'> } {
  const shownTarget = displayTarget(exercise.currentTarget);
  const dpw = effectiveDaysPerWeek ?? exercise.daysPerWeek ?? 7;

  const log: Omit<DailyLog, 'id'> = {
    exerciseId: exercise.id,
    dayNumber: exercise.currentDay,
    target: shownTarget,
    completed: isRestDay ? 0 : completed,
    date: todayISO(),
    isRestDay,
  };

  if (isRestDay) {
    return {
      updatedExercise: {
        currentDay: exercise.currentDay + 1,
      },
      log,
    };
  }

  const newDailyRate = adjustDailyRate(exercise.dailyRate, completed, shownTarget);
  const newConsistency = adjustConsistency(exercise.consistency ?? 0, completed, shownTarget);
  const newTarget = advanceTarget(exercise.currentTarget, newDailyRate, dpw);
  const completionRatio = shownTarget > 0 ? completed / shownTarget : 0;
  const newStreak = completionRatio >= 0.85 ? exercise.streak + 1 : 0;

  return {
    updatedExercise: {
      currentTarget: newTarget,
      dailyRate: newDailyRate,
      consistency: newConsistency,
      streak: newStreak,
      totalReps: exercise.totalReps + completed,
      currentDay: exercise.currentDay + 1,
    },
    log,
  };
}
