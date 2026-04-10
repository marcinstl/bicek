import type { RpgRarity } from '@/lib/types';

/** Ikona kosztu Hunt Points — jak w modalu wyprawy / przycisku Hunt (`app/(app)/rpg/page.tsx`). */
export const HUNT_POINT_SPRITE = { col: 3, row: 47 } as const;

/** Kryształ fragmentu — jak w pasku fragmentów na stronie RPG. */
export const FRAGMENT_CRYSTAL_SPRITE = { col: 4, row: 47 } as const;

export const RPG_RARITY_ORDER: RpgRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Tint na krysztale — te same kolory co `RARITY_TINT_HEX` na stronie RPG. */
export const RARITY_CRYSTAL_TINT_HEX: Record<RpgRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

/**
 * Ramka pod miniaturę ikony — te same klasy Tailwind co kontener sprite w modalu wyprawy
 * (`app/(app)/rpg/page.tsx`, przyciski „Wybierz wyprawę”).
 */
export const RARITY_ICON_FRAME_STYLES: Record<RpgRarity, { border: string; bg: string }> = {
  common: { border: 'border-gray-300', bg: 'bg-gray-100' },
  uncommon: { border: 'border-green-400', bg: 'bg-green-50' },
  rare: { border: 'border-blue-400', bg: 'bg-blue-50' },
  epic: { border: 'border-purple-400', bg: 'bg-purple-50' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-50' },
};

/** Jak `SpriteIcon` w modalu wyprawy / pasku fragmentów. */
export const RARITY_SPRITE_TINT_OPACITY = 0.78 as const;
