'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDiscoveredItems,
  equipRpgItem,
  getRpgEquipment,
  getRpgItems,
  unequipRpgItem,
} from '@/lib/api-router';

export const rpgKeys = {
  all: ['rpg'] as const,
  items: () => [...rpgKeys.all, 'items'] as const,
  discoveries: () => [...rpgKeys.all, 'discoveries'] as const,
  equipment: () => [...rpgKeys.all, 'equipment'] as const,
};

export function useRpgItems() {
  return useQuery({
    queryKey: rpgKeys.items(),
    queryFn: getRpgItems,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
  });
}

export function useRpgEquipment() {
  return useQuery({
    queryKey: rpgKeys.equipment(),
    queryFn: getRpgEquipment,
    staleTime: 1000 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

export function useRpgDiscoveries() {
  return useQuery({
    queryKey: rpgKeys.discoveries(),
    queryFn: getDiscoveredItems,
    staleTime: 1000 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

export function useEquipRpgItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { item_id: string }) => equipRpgItem(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.equipment() });
      queryClient.invalidateQueries({ queryKey: rpgKeys.discoveries() });
    },
  });
}

export function useUnequipRpgItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => unequipRpgItem(itemId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rpgKeys.equipment() });
    },
  });
}
