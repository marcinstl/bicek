import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { computeSetXp } from '@/lib/rpg/xp';
import type { ExerciseKind } from '@/lib/types';

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_CALL = 5;

type BackfillRow = {
  id: string;
  value: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  exercises: { kind: ExerciseKind } | Array<{ kind: ExerciseKind }> | null;
};

function pickKind(row: BackfillRow): ExerciseKind {
  if (Array.isArray(row.exercises)) return row.exercises[0]?.kind ?? 'bodyweight_reps';
  return row.exercises?.kind ?? 'bodyweight_reps';
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let processed = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_CALL; batch += 1) {
    const { data, error } = await supabase
      .from('sets')
      .select('id, value, reps, duration_seconds, distance_km, exercises!inner(kind)')
      .is('xp', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as BackfillRow[];
    if (rows.length === 0) break;

    await Promise.all(
      rows.map(async (row) => {
        const kind = pickKind(row);
        const xp = computeSetXp(kind, row);
        const { error: updateError } = await supabase
          .from('sets')
          .update({ xp })
          .eq('id', row.id)
          .is('xp', null);
        if (updateError) throw updateError;
      })
    );

    processed += rows.length;

    if (rows.length < BATCH_SIZE) break;
  }

  return NextResponse.json({ processed });
}
