function twoDigit(n: number): string {
  return String(n).padStart(2, '0');
}

const setA = Array.from({ length: 40 }, (_, i) => `Iicon_32_${twoDigit(i + 1)}.png`);
const setB = Array.from({ length: 30 }, (_, i) => `icon_32_2_${twoDigit(i + 1)}.png`);

export type PixelArtItemType = 'weapon-sword';
export type PixelArtItemEqSlot = 'slot-weapon';

export interface PixelArtItem {
  fileName: string;
  name: string;
  type: PixelArtItemType;
  eqSlot: PixelArtItemEqSlot;
}

export const PIXEL_ART_ITEMS: PixelArtItem[] = [...setA, ...setB].map((fileName) => ({
  fileName,
  name: fileName,
  type: 'weapon-sword',
  eqSlot: 'slot-weapon',
}));
