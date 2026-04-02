import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { checkRequirements } from '@/lib/rpg/requirements';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind, RpgDiscoveredItem } from '@/lib/types';

type SetRow = {
  xp: number | null;
  exercises: { kind: ExerciseKind } | Array<{ kind: ExerciseKind }> | null;
};

function pickKind(row: SetRow): ExerciseKind {
  if (Array.isArray(row.exercises)) return row.exercises[0]?.kind ?? 'bodyweight_reps';
  return row.exercises?.kind ?? 'bodyweight_reps';
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 1. User stats ────────────────────────────────────────────────────────

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null);

  if (workoutsError) return NextResponse.json({ error: workoutsError.message }, { status: 500 });

  const workoutIds = workouts?.map((w) => w.id) ?? [];
  const workoutCount = workoutIds.length;

  const kindTotals: Record<ExerciseKind, number> = {
    weighted_reps: 0,
    bodyweight_reps: 0,
    time_based: 0,
    distance_per_time: 0,
  };

  if (workoutIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select('xp, exercises!inner(kind)')
      .in('workout_id', workoutIds);

    if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

    for (const s of sets ?? []) {
      const row = s as SetRow;
      const kind = pickKind(row);
      const xp = row.xp ?? computeSetXp(kind, { value: null, reps: null, duration_seconds: null, distance_km: null });
      kindTotals[kind] += xp;
    }
  }

  const totalXp = Object.values(kindTotals).reduce((sum, v) => sum + v, 0);
  const context = { totalXp, kindTotals, workoutCount };

  // ── 2. Undiscovered items ────────────────────────────────────────────────

  const [itemsResult, discoveriesResult] = await Promise.all([
    supabase.from('rpg_items').select('id,eq_slot,icon_path,requirements'),
    supabase.from('rpg_item_discoveries').select('item_id').eq('user_id', user.id),
  ]);

  if (itemsResult.error) return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });
  if (discoveriesResult.error) return NextResponse.json({ error: discoveriesResult.error.message }, { status: 500 });

  const discoveredIds = new Set((discoveriesResult.data ?? []).map((d) => d.item_id));
  const undiscovered = (itemsResult.data ?? [] as RpgDiscoveredItem[]).filter(
    (item) => !discoveredIds.has(item.id)
  );

  // ── 3. Check & insert qualifying items ──────────────────────────────────

  const eligible = undiscovered.filter((item) =>
    checkRequirements((item as RpgDiscoveredItem).requirements, context)
  );

  if (eligible.length === 0) {
    return NextResponse.json({ newly_discovered: [] });
  }

  const admin = createAdminSupabaseClient();
  const { error: insertError } = await admin.from('rpg_item_discoveries').upsert(
    eligible.map((item) => ({ user_id: user.id, item_id: item.id })),
    { onConflict: 'user_id,item_id' }
  );

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ newly_discovered: eligible.map((i) => i.id) });
}
