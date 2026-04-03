import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { HUNT_CONFIG_BY_RARITY } from '@/lib/rpg/hunts';
import type { RpgRarity } from '@/lib/types';

/** POST /api/rpg/hunt/start — starts a new hunt for the authenticated user. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { rarity: unknown };
  const rarity = body.rarity as RpgRarity;

  if (!HUNT_CONFIG_BY_RARITY[rarity]) {
    return NextResponse.json({ error: 'Invalid rarity' }, { status: 400 });
  }

  // Reject if an active (uncollected) hunt already exists.
  const { data: existing, error: existingError } = await supabase
    .from('rpg_hunts')
    .select('id')
    .eq('user_id', user.id)
    .is('collected_at', null)
    .limit(1)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({ error: 'Hunt already in progress' }, { status: 409 });
  }

  const config = HUNT_CONFIG_BY_RARITY[rarity];

  const { data: hunt, error: insertError } = await supabase
    .from('rpg_hunts')
    .insert({ user_id: user.id, rarity, duration_hours: config.duration_hours })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(hunt);
}
