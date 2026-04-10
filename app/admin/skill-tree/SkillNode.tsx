'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { SpriteIcon } from '@/components/SpriteIcon';
import {
  RARITY_CRYSTAL_TINT_HEX,
  RARITY_SPRITE_TINT_OPACITY,
} from '@/lib/rpg/rpg-currency-ui';
import type { SkillNodeData } from '@/lib/skill-tree/types';
import { BRANCH_NODE_RING, skillNodeLayout } from '@/lib/skill-tree/types';
import { useSkillTreeCanvasMode } from './SkillTreeCanvasModeContext';

/** Kąt w stopniach od osi X (0° = prawo, 90° = dół ekranu). */
function degToOffset(deg: number, r: number): { dx: number; dy: number } {
  const rad = (deg * Math.PI) / 180;
  return { dx: r * Math.cos(rad), dy: r * Math.sin(rad) };
}

/** Readonly / brak providera: niewidoczne, pełny cel kliknięcia. */
const handleInvisibleClass =
  'nodrag pointer-events-auto !absolute !z-20 !rounded-full !border-0 !bg-transparent !opacity-0';

const handleTargetVisibleClass =
  'nodrag pointer-events-auto !absolute !z-20 !rounded-full !border-2 !border-slate-900 !bg-sky-400 hover:!brightness-110';

const handleSourceVisibleClass =
  'nodrag pointer-events-auto !absolute !z-20 !rounded-full !border-2 !border-slate-900 !bg-emerald-500 hover:!brightness-110';

/**
 * Drzewko w prawo: jedno wejście po lewej (180°), jedno wyjście po prawej (0°).
 */
export function SkillTreeNode({ data: raw, selected }: NodeProps) {
  const canvasMode = useSkillTreeCanvasMode();
  const showHandleDots = canvasMode === 'edit';
  const data = raw as SkillNodeData;
  const ring = BRANCH_NODE_RING[data.branch];
  const spritePositions = data.spritePositions ?? [];
  const tintRarity = data.spriteIconTintRarity;
  const tintColor =
    tintRarity != null ? RARITY_CRYSTAL_TINT_HEX[tintRarity] : undefined;
  const lay = skillNodeLayout(data.nodeSize);
  const d = lay.circle;
  const handlePx = Math.max(12, Math.min(18, Math.round(d * 0.32)));
  const rEdge = d / 2 - 1;

  const left = degToOffset(180, rEdge);
  const right = degToOffset(0, rEdge);

  const leftStyle = {
    left: `calc(50% + ${left.dx}px)`,
    top: `calc(50% + ${left.dy}px)`,
    transform: 'translate(-50%, -50%)',
    width: handlePx,
    height: handlePx,
  } as const;

  const rightStyle = {
    left: `calc(50% + ${right.dx}px)`,
    top: `calc(50% + ${right.dy}px)`,
    transform: 'translate(-50%, -50%)',
    width: handlePx,
    height: handlePx,
  } as const;

  return (
    <div className="relative shrink-0 overflow-visible" style={{ width: d, height: d }}>
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-full border-2 bg-slate-900/95 ${ring} ${
          selected ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-slate-950' : ''
        }`}
      >
        {spritePositions.length > 0 ? (
          <SpriteIcon
            positions={spritePositions}
            size={lay.sprite}
            tintColor={tintColor}
            tintOpacity={RARITY_SPRITE_TINT_OPACITY}
          />
        ) : (
          <span
            className={`px-1 text-center font-bold leading-tight text-white/95 line-clamp-3 ${lay.labelClass}`}
            style={{ maxWidth: lay.labelMax }}
          >
            {data.label || '…'}
          </span>
        )}
      </div>

      <span
        className={`pointer-events-none absolute left-1/2 top-full z-0 mt-1 -translate-x-1/2 tabular-nums text-slate-500 ${lay.ranksClass}`}
      >
        0/{Math.max(1, data.maxRanks)}
      </span>

      <Handle
        type="target"
        position={Position.Left}
        id="l-in"
        style={leftStyle}
        className={showHandleDots ? handleTargetVisibleClass : handleInvisibleClass}
        title={showHandleDots ? 'Wejście (lewo)' : undefined}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r-out"
        style={rightStyle}
        className={showHandleDots ? handleSourceVisibleClass : handleInvisibleClass}
        title={showHandleDots ? 'Wyjście (prawo)' : undefined}
      />
    </div>
  );
}
