import type { SkillNodeData } from './types';
import { skillNodeLayout } from './types';

/** Zgodne z `Background` w edytorze (`gap={20}`). */
export const SKILL_TREE_EDITOR_SNAP_GRID = [20, 20] as const;

/**
 * Pozycja React Flow to lewy górny róg węzła (`SkillTreeNode` = kwadrat d×d).
 * Snap: środek okręgu (`d = skillNodeLayout(nodeSize).circle`) na krzyż siatki.
 */
export function snapSkillNodeTopLeftToGrid(
  position: { x: number; y: number },
  data: SkillNodeData,
  grid: readonly [number, number] = SKILL_TREE_EDITOR_SNAP_GRID,
): { x: number; y: number } {
  const d = skillNodeLayout(data.nodeSize).circle;
  const [gx, gy] = grid;
  const cx = position.x + d / 2;
  const cy = position.y + d / 2;
  const sx = Math.round(cx / gx) * gx;
  const sy = Math.round(cy / gy) * gy;
  return { x: sx - d / 2, y: sy - d / 2 };
}

/** Przy zmianie `nodeSize` przesuń top-left tak, żeby środek okręgu został w tym samym miejscu. */
export function shiftTopLeftToPreserveCircleCenter(
  position: { x: number; y: number },
  oldNodeSize: SkillNodeData['nodeSize'],
  newNodeSize: SkillNodeData['nodeSize'],
): { x: number; y: number } {
  const oldD = skillNodeLayout(oldNodeSize).circle;
  const newD = skillNodeLayout(newNodeSize).circle;
  const delta = (newD - oldD) / 2;
  return { x: position.x - delta, y: position.y - delta };
}
