'use client';

import {
  EQ_SPRITES_CELL as CELL,
  EQ_SPRITES_COLS as COLS,
  EQ_SPRITES_PATH,
  EQ_SPRITES_ROWS as ROWS,
  EQ_SPRITES_SHEET_H as SHEET_H,
  EQ_SPRITES_SHEET_W as SHEET_W,
} from '@/lib/rpg/eq-sprites-sheet';
import type { SpritePosition } from '@/lib/types';

const PICKER_CELL = 44;

type EqSpritePickerModalProps = {
  open: boolean;
  onClose: () => void;
  /** Wybór jednej lub wielu klatek (jak w RPG); pusta tablica = brak ikony. */
  onPick: (positions: SpritePosition[]) => void;
  /** Jeśli true, klik w komórkę przełącza ją w kolejności (jak edytor itemów). Jeśli false — jedna klatka, klik zastępuje wybór. */
  multiFrame?: boolean;
  currentPositions: SpritePosition[];
};

function posKey(p: SpritePosition) {
  return `${p.col}:${p.row}`;
}

export function EqSpritePickerModal({
  open,
  onClose,
  onPick,
  multiFrame = false,
  currentPositions,
}: EqSpritePickerModalProps) {
  if (!open) return null;

  const selectedMap = new Map<string, number>();
  currentPositions.forEach((p, i) => selectedMap.set(posKey(p), i + 1));

  const handleCellClick = (col: number, row: number) => {
    if (multiFrame) {
      const key = posKey({ col, row });
      const existing = currentPositions.findIndex((p) => posKey(p) === key);
      let next: SpritePosition[];
      if (existing >= 0) {
        next = currentPositions.filter((_, i) => i !== existing);
      } else {
        next = [...currentPositions, { col, row }];
      }
      onPick(next);
      return;
    }
    onPick([{ col, row }]);
    onClose();
  };

  const scale = PICKER_CELL / CELL;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Wybór ikony z arkusza"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-600 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Ikona z eq_sprites_t.png</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onPick([]);
                if (!multiFrame) onClose();
              }}
              className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Wyczyść wybór
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
            >
              {multiFrame ? 'Gotowe' : 'Zamknij'}
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <div
            className="inline-grid border border-gray-300"
            style={{
              gridTemplateColumns: `repeat(${COLS}, ${PICKER_CELL}px)`,
              gap: 1,
              backgroundColor: '#d1d5db',
            }}
          >
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: COLS }, (_, col) => {
                const key = posKey({ col, row });
                const order = selectedMap.get(key);
                const isSelected = order !== undefined;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleCellClick(col, row)}
                    title={`col=${col} row=${row}`}
                    className="relative overflow-hidden hover:opacity-80"
                    style={{
                      width: PICKER_CELL,
                      height: PICKER_CELL,
                      backgroundImage: `url(${EQ_SPRITES_PATH})`,
                      backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
                      backgroundPosition: `${-(col * CELL * scale)}px ${-(row * CELL * scale)}px`,
                      backgroundRepeat: 'no-repeat',
                      imageRendering: 'pixelated',
                      outline: isSelected ? '2px solid #16a34a' : '1px solid transparent',
                      outlineOffset: '-2px',
                    }}
                  >
                    {isSelected && multiFrame ? (
                      <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-tl bg-emerald-600 text-[8px] font-bold leading-none text-white">
                        {order}
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {multiFrame
              ? 'Klikaj komórki, aby dodać lub usunąć klatki animacji. Kolejność = kolejność kliknięć.'
              : 'Kliknij komórkę, aby ustawić ikonę węzła (zamknie okno).'}
          </p>
        </div>
      </div>
    </div>
  );
}
