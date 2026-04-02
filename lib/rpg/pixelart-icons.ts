import type { RpgDiscoveredItem, RpgRequirement } from '@/lib/types';

export type PixelArtItemType = 'weapon-sword';
export type PixelArtItemEqSlot = 'slot-weapon';

export interface PixelArtItem {
  fileName: string;
  name: string;
  type: PixelArtItemType;
  eqSlot: PixelArtItemEqSlot;
}

function twoDigit(n: number): string {
  return String(n).padStart(2, '0');
}

const mockFileNames = [
  ...Array.from({ length: 40 }, (_, i) => `Iicon_32_${twoDigit(i + 1)}.png`),
  ...Array.from({ length: 30 }, (_, i) => `icon_32_2_${twoDigit(i + 1)}.png`),
];

function requirementsForIndex(i: number): RpgRequirement[] {
  if (i < 10) return [];
  if (i < 25) return [{ type: 'total_level', level: 2 }];
  if (i < 40) return [{ type: 'total_level', level: 3 }];
  if (i < 55) return [{ type: 'kind_level', kind: 'weighted_reps', level: 3 }];
  if (i < 65) return [{ type: 'total_level', level: 5 }, { type: 'workout_count', count: 5 }];
  return [{ type: 'total_level', level: 8, secret: true }];
}

export const MOCK_RPG_ITEMS: RpgDiscoveredItem[] = mockFileNames.map((fileName, i) => ({
  id: `mock-${fileName}`,
  eq_slot: 'slot-weapon',
  icon_path: `pixelart/${fileName}`,
  name: fileName.replace('.png', '').replace(/_/g, ' '),
  item_type: 'weapon-sword',
  requirements: requirementsForIndex(i).map((req) =>
    'secret' in req && req.secret
      ? ({ type: 'secret' } as import('@/lib/types').RpgRequirement)
      : req
  ),
}));
