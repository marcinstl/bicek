'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExercise,
  deleteExercise,
  getExercises,
  updateExercise,
} from '@/lib/api';
import type { CreateExerciseInput, UpdateExerciseInput } from '@/lib/types';

export const exerciseKeys = {
  all: ['exercises'] as const,
  byPlan: (planId: string) => [...exerciseKeys.all, planId] as const,
};

export function useExercises(planId: string) {
  return useQuery({
    queryKey: exerciseKeys.byPlan(planId),
    queryFn: () => getExercises(planId),
    enabled: !!planId,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExerciseInput) => createExercise(input),
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.byPlan(variables.plan_id) });
    },
  });
}

export function useUpdateExercise(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExerciseInput }) =>
      updateExercise(id, input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.byPlan(planId) });
    },
  });
}

export function useDeleteExercise(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExercise(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.byPlan(planId) });
    },
  });
}
