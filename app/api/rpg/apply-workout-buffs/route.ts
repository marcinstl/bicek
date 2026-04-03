import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { computeXpRates } from '@/lib/rpg/buffs';
import type { RpgItemBuff } from '@/lib/types';

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let workoutId: string | undefined;
  try {
    const body = (await req.json()) as { workoutId?: string };
    workoutId = body.workoutId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!workoutId) {
    return NextResponse.json({ error: 'workoutId is required' }, { status: 400 });
  }

  // Read equipped items and their buffs
  const { data: equipment, error: eqError } = await supabase
    .from('rpg_equipment')
    .select('rpg_items(buffs)')
    .eq('user_id', user.id);

  if (eqError) return NextResponse.json({ error: eqError.message }, { status: 500 });

  const equippedItems = (equipment ?? []).map((row) => {
    const item = Array.isArray(row.rpg_items) ? row.rpg_items[0] : row.rpg_items;
    return { buffs: (item?.buffs ?? []) as RpgItemBuff[] };
  });

  const xpRates = computeXpRates(equippedItems);

  // Update the workout — only allow updating workouts belonging to this user
  const { error: updateError } = await supabase
    .from('workouts')
    .update({ xp_rates: xpRates })
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .not('ended_at', 'is', null);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ xp_rates: xpRates });
}
