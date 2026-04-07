'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collectHunt,
  equipRpgItem,
  getActiveHunt,
  getRpgInventory,
  getRpgItems,
  startHunt,
  unequipRpgItem,
} from '@/lib/api-router';
import { createClient } from '@/lib/supabase';
import type { RpgRarity } from '@/lib/types';

export const rpgKeys = {
  all: ['rpg'] as const,
  items: () => [...rpgKeys.all, 'items'] as const,
  inventory: () => [...rpgKeys.all, 'inventory'] as const,
  hunt: () => [...rpgKeys.all, 'hunt'] as const,
  huntPoints: () => [...rpgKeys.all, 'hunt-points'] as const,
};

export function useRpgItems() {
  return useQuery({
    queryKey: rpgKeys.items(),
    queryFn: getRpgItems,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
  });
}

export function useRpgInventory() {
  return useQuery({
    queryKey: rpgKeys.inventory(),
    queryFn: getRpgInventory,
    staleTime: 1000 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

export function useActiveHunt() {
  return useQuery({
    queryKey: rpgKeys.hunt(),
    queryFn: getActiveHunt,
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function useHuntPoints() {
  return useQuery({
    queryKey: rpgKeys.huntPoints(),
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('hunt_points, hunt_points_maximum')
        .eq('id', user.id)
        .single();
      return data as { hunt_points: number; hunt_points_maximum: number } | null;
    },
    staleTime: 0,
  });
}

export function useEquipRpgItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { item_id: string }) => equipRpgItem(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.inventory() });
    },
  });
}

export function useUnequipRpgItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => unequipRpgItem(itemId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.inventory() });
    },
  });
}

export function useStartHunt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rarity: RpgRarity) => startHunt(rarity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.hunt() });
      queryClient.invalidateQueries({ queryKey: rpgKeys.huntPoints() });
    },
  });
}

export function useCollectHunt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => collectHunt(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.hunt() });
      queryClient.invalidateQueries({ queryKey: rpgKeys.inventory() });
      queryClient.invalidateQueries({ queryKey: rpgKeys.items() });
      queryClient.invalidateQueries({ queryKey: rpgKeys.huntPoints() });
    },
  });
}
