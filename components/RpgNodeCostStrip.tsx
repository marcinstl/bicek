'use client';

import { SpriteIcon } from '@/components/SpriteIcon';
import {
  FRAGMENT_CRYSTAL_SPRITE,
  HUNT_POINT_SPRITE,
  RARITY_CRYSTAL_TINT_HEX,
  RPG_RARITY_ORDER,
} from '@/lib/rpg/rpg-currency-ui';
import { RARITY_LABELS } from '@/lib/rpg/hunts';
import type { RpgRarity } from '@/lib/types';

/** Miniaturowe „pigułki” fragmentów na ciemnym tle (skill tree / admin). */
const FRAGMENT_PILL_DARK: Record<RpgRarity, string> = {
  common: 'border-slate-500 bg-slate-800/90 text-slate-200',
  uncommon: 'border-green-500/50 bg-green-950/60 text-green-200',
  rare: 'border-blue-500/50 bg-blue-950/60 text-blue-200',
  epic: 'border-purple-500/50 bg-purple-950/60 text-purple-200',
  legendary: 'border-yellow-500/50 bg-yellow-950/50 text-yellow-200',
};

type RpgNodeCostStripProps = {
  huntPoints: number;
  fragments: Partial<Record<RpgRarity, number>> | Record<RpgRarity, number>;
  /** Mniejsze ikony — pod małe węzły na canvasie. */
  compact?: boolean;
};

export function RpgNodeCostStrip({ huntPoints, fragments, compact }: RpgNodeCostStripProps) {
  const hp = Math.max(0, Math.floor(huntPoints));
  const crystalSize = compact ? 11 : 16;
  const huntIconSize = compact ? 10 : 12;
  const hasHp = hp > 0;
  const fragmentEntries = RPG_RARITY_ORDER.filter((tier) => (fragments[tier] ?? 0) > 0);
  const hasFragments = fragmentEntries.length > 0;

  if (!hasHp && !hasFragments) return null;

  return (
    <div
      className={`flex max-w-[min(200px,85vw)] flex-wrap items-center justify-center gap-0.5 ${compact ? 'text-[8px]' : 'text-[9px]'}`}
    >
      {hasHp ? (
        <span
          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-bold tabular-nums ${
            compact
              ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/40'
              : 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35'
          }`}
          title="Hunt Points"
        >
          {hp}
          <SpriteIcon positions={[HUNT_POINT_SPRITE]} size={huntIconSize} />
        </span>
      ) : null}
      {fragmentEntries.map((tier) => {
        const n = Math.max(0, Math.floor(fragments[tier] ?? 0));
        return (
          <span
            key={tier}
            className={`inline-flex items-center gap-0.5 rounded border px-0.5 py-px font-bold tabular-nums ${FRAGMENT_PILL_DARK[tier]}`}
            title={`Fragmenty: ${RARITY_LABELS[tier]}`}
          >
            <SpriteIcon
              positions={[FRAGMENT_CRYSTAL_SPRITE]}
              size={crystalSize}
              tintColor={RARITY_CRYSTAL_TINT_HEX[tier]}
              tintOpacity={0.78}
            />
            {n}
          </span>
        );
      })}
    </div>
  );
}
