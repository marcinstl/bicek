'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlan, deletePlan, getPlans, updatePlan } from '@/lib/api';
import type { CreatePlanInput, Plan, UpdatePlanInput } from '@/lib/types';

export const planKeys = {
  all: ['plans'] as const,
  list: () => [...planKeys.all, 'list'] as const,
};

export function usePlans() {
  return useQuery({
    queryKey: planKeys.list(),
    queryFn: getPlans,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlanInput) => createPlan(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: planKeys.list() });
      const previous = queryClient.getQueryData<Plan[]>(planKeys.list());

      queryClient.setQueryData<Plan[]>(planKeys.list(), (old = []) => [
        {
          id: `optimistic-${Date.now()}`,
          user_id: '',
          name: input.name,
          created_at: new Date().toISOString(),
        },
        ...old,
      ]);

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(planKeys.list(), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanInput }) => updatePlan(id, input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: planKeys.list() });
      const previous = queryClient.getQueryData<Plan[]>(planKeys.list());
      queryClient.setQueryData<Plan[]>(planKeys.list(), (old = []) =>
        old.filter((p) => p.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(planKeys.list(), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
    },
  });
}
