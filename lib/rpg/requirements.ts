import { getLevelProgress } from '@/lib/rpg/leveling';
import type { ExerciseKind, RpgRequirement } from '@/lib/types';

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
