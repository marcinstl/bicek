'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * `edit` — widać kropki wejścia/wyjścia (admin).
 * `readonly` — uchwyty niewidoczne (np. podgląd w grze); w DOM zostają dla końców krawędzi.
 */
export type SkillTreeCanvasMode = 'edit' | 'readonly';

const SkillTreeCanvasModeContext = createContext<SkillTreeCanvasMode>('edit');

export function SkillTreeCanvasModeProvider({
  mode,
  children,
}: {
  mode: SkillTreeCanvasMode;
  children: ReactNode;
}) {
  return (
    <SkillTreeCanvasModeContext.Provider value={mode}>{children}</SkillTreeCanvasModeContext.Provider>
  );
}

export function useSkillTreeCanvasMode(): SkillTreeCanvasMode {
  return useContext(SkillTreeCanvasModeContext);
}
