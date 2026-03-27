function twoDigit(n: number): string {
  return String(n).padStart(2, '0');
}

const setA = Array.from({ length: 40 }, (_, i) => `Iicon_32_${twoDigit(i + 1)}.png`);
const setB = Array.from({ length: 30 }, (_, i) => `icon_32_2_${twoDigit(i + 1)}.png`);

export const PIXEL_ART_ICONS = [...setA, ...setB] as const;
