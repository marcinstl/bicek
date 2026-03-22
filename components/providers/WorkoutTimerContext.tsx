'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAnyActiveWorkout } from '@/lib/api-router';

export const ACTIVE_WORKOUT_KEY = ['active-workout-global'] as const;

interface WorkoutTimerContextValue {
  activeWorkoutId: string | null;
  activePlanId: string | null;
  elapsed: number;
  invalidateActiveWorkout: () => void;
}

const WorkoutTimerContext = createContext<WorkoutTimerContextValue>({
  activeWorkoutId: null,
  activePlanId: null,
  elapsed: 0,
  invalidateActiveWorkout: () => {},
});

export function WorkoutTimerProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: activeWorkout } = useQuery({
    queryKey: ACTIVE_WORKOUT_KEY,
    queryFn: getAnyActiveWorkout,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const startedAt = activeWorkout?.started_at ?? null;
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!startedAt) { setElapsed(0); return; }

    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startedAt]);

  function invalidateActiveWorkout() {
    queryClient.invalidateQueries({ queryKey: ACTIVE_WORKOUT_KEY });
  }

  return (
    <WorkoutTimerContext.Provider value={{ activeWorkoutId: activeWorkout?.id ?? null, activePlanId: activeWorkout?.plan_id ?? null, elapsed, invalidateActiveWorkout }}>
      {children}
    </WorkoutTimerContext.Provider>
  );
}

export function useWorkoutTimer() {
  return useContext(WorkoutTimerContext);
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
