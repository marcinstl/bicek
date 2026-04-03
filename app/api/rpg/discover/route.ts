import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { checkRequirements, rowsToRequirements } from '@/lib/rpg/requirements';
import { applyXpRates, applyKindRate } from '@/lib/rpg/buffs';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind, XpRates } from '@/lib/types';

const EXERCISE_KINDS: ExerciseKind[] = [
  'weighted_reps',
  'bodyweight_reps',
  'time_based',
  'distance_per_time',
];

type SetRow = {
  workout_id: string;
  xp: number | null;
  exercises: { kind: ExerciseKind } | Array<{ kind: ExerciseKind }> | null;
};

function pickKind(row: SetRow): ExerciseKind {
  if (Array.isArray(row.exercises)) return row.exercises[0]?.kind ?? 'bodyweight_reps';
  return row.exercises?.kind ?? 'bodyweight_reps';
}

function defaultRates(): XpRates {
  return { weighted_reps: 100, bodyweight_reps: 100, time_based: 100, distance_per_time: 100, total: 100 };
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 1. Fetch completed workouts with xp_rates ─────────────────────────────

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id, xp_rates')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null);

  if (workoutsError) return NextResponse.json({ error: workoutsError.message }, { status: 500 });

  const workoutList = workouts ?? [];
  const workoutCount = workoutList.length;
  const workoutIds = workoutList.map((w) => w.id);

  // Build a map from workout_id → xp_rates
  const xpRatesById = new Map<string, XpRates>(
    workoutList.map((w) => [w.id, (w.xp_rates as XpRates | null) ?? defaultRates()])
  );

  // ── 2. Fetch sets and compute effective XP per workout ────────────────────

  const kindTotals: Record<ExerciseKind, number> = {
    weighted_reps: 0,
    bodyweight_reps: 0,
    time_based: 0,
    distance_per_time: 0,
  };

  let effectiveTotalXp = 0;

  if (workoutIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select('workout_id, xp, exercises!inner(kind)')
      .in('workout_id', workoutIds);

    if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

    // Group base XP per workout, per kind
    const byWorkout = new Map<string, Record<ExerciseKind, number>>();
    for (const s of sets ?? []) {
      const row = s as SetRow;
      const kind = pickKind(row);
      const xp = row.xp ?? computeSetXp(kind, { value: null, reps: null, duration_seconds: null, distance_km: null });

      if (!byWorkout.has(row.workout_id)) {
        byWorkout.set(row.workout_id, { weighted_reps: 0, bodyweight_reps: 0, time_based: 0, distance_per_time: 0 });
      }
      byWorkout.get(row.workout_id)![kind] += xp;
    }

    // Apply xp_rates per workout:
    // - effectiveTotalXp: only total rate applies (per-kind rates don't affect overall level)
    // - kindTotals: each kind uses its own rate independently
    for (const [workoutId, baseKindXp] of byWorkout) {
      const rates = xpRatesById.get(workoutId) ?? defaultRates();

      effectiveTotalXp += applyXpRates(baseKindXp, rates);

      for (const kind of EXERCISE_KINDS) {
        kindTotals[kind] += applyKindRate(baseKindXp[kind], rates[kind]);
      }
    }
  }

  const context = { totalXp: effectiveTotalXp, kindTotals, workoutCount };

  // ── 3. Undiscovered items ─────────────────────────────────────────────────

  const [itemsResult, discoveriesResult] = await Promise.all([
    supabase
      .from('rpg_items')
      .select('id, rpg_item_requirements(type,level,kind,xp,count,secret)'),
    supabase.from('rpg_item_discoveries').select('item_id').eq('user_id', user.id),
  ]);

  if (itemsResult.error) return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });
  if (discoveriesResult.error) return NextResponse.json({ error: discoveriesResult.error.message }, { status: 500 });

  const discoveredIds = new Set((discoveriesResult.data ?? []).map((d) => d.item_id));
  const undiscovered = (itemsResult.data ?? []).filter((item) => !discoveredIds.has(item.id));

  // ── 4. Check & insert qualifying items ───────────────────────────────────

  const eligible = undiscovered.filter((item) => {
    const reqs = rowsToRequirements(
      Array.isArray(item.rpg_item_requirements) ? item.rpg_item_requirements : []
    );
    return checkRequirements(reqs, context);
  });

  if (eligible.length === 0) {
    return NextResponse.json({ newly_discovered: [] });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[rpg/discover] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();
  const { error: insertError } = await admin.from('rpg_item_discoveries').upsert(
    eligible.map((item) => ({ user_id: user.id, item_id: item.id })),
    { onConflict: 'user_id,item_id' }
  );

  if (insertError) {
    console.error('[rpg/discover] insert error:', insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ newly_discovered: eligible.map((i) => i.id) });
}
