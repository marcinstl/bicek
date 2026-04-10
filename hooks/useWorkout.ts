'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rpgKeys } from '@/hooks/useRpgInventory';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getSets,
  getSetsForWorkouts,
  getWorkout,
  getWorkoutHistory,
  getExerciseHistory,
  startWorkout,
} from '@/lib/api-router';
import { ACTIVE_WORKOUT_KEY } from '@/components/providers/WorkoutTimerContext';
import type { AddSetInput, Set } from '@/lib/types';

export const workoutKeys = {
  all: ['workouts'] as const,
  active: (planId: string) => [...workoutKeys.all, 'active', planId] as const,
  detail: (workoutId: string) => [...workoutKeys.all, 'detail', workoutId] as const,
  sets: (workoutId: string) => [...workoutKeys.all, 'sets', workoutId] as const,
  history: () => [...workoutKeys.all, 'history'] as const,
  setsBatch: (workoutIdsKey: string) => [...workoutKeys.all, 'sets-batch', workoutIdsKey] as const,
};

export function useSetsForWorkouts(workoutIds: string[], enabled: boolean) {
  const key = useMemo(() => [...workoutIds].sort().join(','), [workoutIds]);
  return useQuery({
    queryKey: workoutKeys.setsBatch(key),
    queryFn: () => getSetsForWorkouts(workoutIds),
    enabled: enabled && workoutIds.length > 0,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useActiveWorkout(planId: string) {
  return useQuery({
    queryKey: workoutKeys.active(planId),
    queryFn: () => getActiveWorkout(planId),
    enabled: !!planId,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useWorkout(workoutId: string) {
  return useQuery({
    queryKey: workoutKeys.detail(workoutId),
    queryFn: () => getWorkout(workoutId),
    enabled: !!workoutId,
  });
}

export function useWorkoutSets(workoutId: string) {
  return useQuery({
    queryKey: workoutKeys.sets(workoutId),
    queryFn: () => getSets(workoutId),
    enabled: !!workoutId,
    refetchInterval: 5000,
  });
}

export function useWorkoutHistory() {
  return useQuery({
    queryKey: workoutKeys.history(),
    queryFn: getWorkoutHistory,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useStartWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => startWorkout(planId),
    onSuccess: (_data, planId) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.active(planId) });
      // Immediately reflect in the global header timer
      queryClient.invalidateQueries({ queryKey: ACTIVE_WORKOUT_KEY });
    },
  });
}

export function useFinishWorkout(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutId: string) => finishWorkout(workoutId),
    onSuccess: (_data, workoutId) => {
      // Keep UI consistent immediately after finishing workout.
      queryClient.setQueryData(workoutKeys.active(planId), null);
      queryClient.setQueryData(ACTIVE_WORKOUT_KEY, null);
      queryClient.invalidateQueries({ queryKey: workoutKeys.active(planId) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('exercise-history-all'),
      });

      // Apply buff-based xp_rates for this workout (fire-and-forget)
      void fetch('/api/rpg/apply-workout-buffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId }),
      });

      void queryClient.invalidateQueries({ queryKey: rpgKeys.profile() });
    },
  });
}

export function useDeleteWorkout(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutId: string) => deleteWorkout(workoutId),
    onSuccess: (_data, workoutId) => {
      // If history page isn't mounted, it won't refetch on mount (refetchOnMount=false),
      // so we must update the cached list eagerly.
      queryClient.setQueryData(workoutKeys.history(), (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((w: any) => w?.id !== workoutId);
      });
      queryClient.removeQueries({ queryKey: workoutKeys.detail(workoutId) });
      queryClient.removeQueries({ queryKey: workoutKeys.sets(workoutId) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.active(planId) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
      queryClient.invalidateQueries({ queryKey: ACTIVE_WORKOUT_KEY });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey.includes('exercise-history-all') || q.queryKey.includes('exercise-history')),
      });
    },
  });
}

export function useAddSet(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddSetInput) => addSet(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: workoutKeys.sets(workoutId) });
      const previous = queryClient.getQueryData(workoutKeys.sets(workoutId));

      queryClient.setQueryData<Set[]>(workoutKeys.sets(workoutId), (old = []) => [
        ...old,
        {
          id: `optimistic-${Date.now()}`,
          workout_id: input.workout_id,
          exercise_id: input.exercise_id,
          value: input.value ?? null,
          reps: input.reps ?? null,
          duration_seconds: input.duration_seconds ?? null,
          distance_km: input.distance_km ?? null,
          xp: input.xp ?? null,
          note: input.note ?? null,
          created_at: new Date().toISOString(),
        },
      ]);

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(workoutKeys.sets(workoutId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.sets(workoutId) });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('sets-batch'),
      });
    },
  });
}

export function useExerciseHistory(exerciseId: string, excludeWorkoutId: string) {
  return useQuery({
    queryKey: [...workoutKeys.all, 'exercise-history', exerciseId, excludeWorkoutId],
    queryFn: () => getExerciseHistory(exerciseId, excludeWorkoutId),
    enabled: !!exerciseId && !!excludeWorkoutId,
  });
}

/** All completed-workout sets for an exercise (no workout excluded). */
export function useExerciseHistoryAll(exerciseId: string) {
  return useQuery({
    queryKey: [...workoutKeys.all, 'exercise-history-all', exerciseId],
    queryFn: () => getExerciseHistory(exerciseId, ''),
    enabled: !!exerciseId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
  });
}

export function useDeleteSet(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSet(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.sets(workoutId) });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('sets-batch'),
      });
    },
  });
}
