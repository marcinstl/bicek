import type { RpgDiscoveredItem } from '@/lib/types';

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

export const MOCK_RPG_ITEMS: RpgDiscoveredItem[] = mockFileNames.map((fileName) => ({
  id: `mock-${fileName}`,
  eq_slot: 'slot-weapon',
  icon_path: `pixelart/${fileName}`,
}));
