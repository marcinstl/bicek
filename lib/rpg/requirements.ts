import { getLevelProgress } from '@/lib/rpg/leveling';
import type { ExerciseKind, RpgRequirement } from '@/lib/types';

/** Shape of a row from the rpg_item_requirements table. */
export type RequirementRow = {
  type: string;
  level: number | null;
  kind: string | null;
  xp: number | null;
  count: number | null;
  secret: boolean;
};

/** Convert DB rows to typed RpgRequirement objects. */
export function rowsToRequirements(rows: RequirementRow[]): RpgRequirement[] {
  return rows.map((row): RpgRequirement => {
    switch (row.type) {
      case 'total_level':
        return { type: 'total_level', level: row.level!, ...(row.secret ? { secret: true } : {}) };
      case 'kind_level':
        return { type: 'kind_level', kind: row.kind as ExerciseKind, level: row.level!, ...(row.secret ? { secret: true } : {}) };
      case 'total_xp':
        return { type: 'total_xp', xp: row.xp!, ...(row.secret ? { secret: true } : {}) };
      case 'workout_count':
        return { type: 'workout_count', count: row.count!, ...(row.secret ? { secret: true } : {}) };
      default:
        return { type: 'total_level', level: 9999 };
    }
  });
}

export interface RequirementsContext {
  totalXp: number;
  kindTotals: Record<ExerciseKind, number>;
  workoutCount: number;
}

export function checkRequirements(
  requirements: RpgRequirement[] | undefined,
  context: RequirementsContext
): boolean {
  if (!requirements || requirements.length === 0) return true;
  return requirements.every((req) => checkSingle(req, context));
}

function checkSingle(req: RpgRequirement, ctx: RequirementsContext): boolean {
  switch (req.type) {
    case 'total_level':
      return getLevelProgress(ctx.totalXp).level >= req.level;
    case 'kind_level':
      return getLevelProgress(ctx.kindTotals[req.kind] ?? 0).level >= req.level;
    case 'total_xp':
      return ctx.totalXp >= req.xp;
    case 'workout_count':
      return ctx.workoutCount >= req.count;
    case 'secret':
      // Sanitized placeholder — real check happens server-side
      return false;
    default:
      return false;
  }
}
