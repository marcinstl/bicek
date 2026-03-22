'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addSet,
  deleteSet,
  finishWorkout,
  getActiveWorkout,
  getSets,
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
};

export function useActiveWorkout(planId: string) {
  return useQuery({
    queryKey: workoutKeys.active(planId),
    queryFn: () => getActiveWorkout(planId),
    enabled: !!planId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.active(planId) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
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

export function useDeleteSet(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSet(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.sets(workoutId) });
    },
  });
}
