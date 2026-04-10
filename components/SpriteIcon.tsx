'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EQ_SPRITES_CELL as CELL,
  EQ_SPRITES_PATH,
  EQ_SPRITES_SHEET_H as SHEET_H,
  EQ_SPRITES_SHEET_W as SHEET_W,
} from '@/lib/rpg/eq-sprites-sheet';
import type { SpritePosition } from '@/lib/types';

interface SpriteIconProps {
  positions: SpritePosition[];
  /** Display size in px — sprite is scaled to fill a square of this size. */
  size?: number;
  /** ms per animation frame (only relevant when positions.length > 1). */
  frameSpeedMs?: number;
  grayscale?: boolean;
  tintColor?: string;
  tintOpacity?: number;
  className?: string;
}

export function SpriteIcon({
  positions,
  size = 56,
  frameSpeedMs = 300,
  grayscale = false,
  tintColor,
  tintOpacity = 0.72,
  className = '',
}: SpriteIconProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (positions.length <= 1) return;
    timerRef.current = setInterval(() => {
      setFrameIdx((i) => (i + 1) % positions.length);
    }, frameSpeedMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [positions.length, frameSpeedMs]);

  const pos = positions[frameIdx] ?? positions[0];
  const scale = size / CELL;
  const bpX = -(pos.col * CELL * scale);
  const bpY = -(pos.row * CELL * scale);
  const spriteBackground = {
    backgroundImage: `url(${EQ_SPRITES_PATH})`,
    backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
    backgroundPosition: `${bpX}px ${bpY}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated' as const,
  };

  return (
    <div aria-hidden="true" className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0"
        style={{
          ...spriteBackground,
          filter: grayscale ? 'grayscale(1) brightness(0.35)' : undefined,
        }}
      />
      {tintColor ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: tintColor,
            opacity: tintOpacity,
            mixBlendMode: 'multiply',
            WebkitMaskImage: `url(${EQ_SPRITES_PATH})`,
            maskImage: `url(${EQ_SPRITES_PATH})`,
            WebkitMaskSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
            maskSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
            WebkitMaskPosition: `${bpX}px ${bpY}px`,
            maskPosition: `${bpX}px ${bpY}px`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />
      ) : null}
    </div>
  );
}
