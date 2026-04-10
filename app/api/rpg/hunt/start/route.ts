import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
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
  const cost = config.hunt_cost;

  // Check and deduct hunt points via admin client (bypasses RLS on rpg_profiles).
  const admin = createAdminSupabaseClient();

  const { data: profile, error: profileError } = await admin
    .from('rpg_profiles')
    .select('hunt_points')
    .eq('user_id', user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if ((profile?.hunt_points ?? 0) < cost) {
    return NextResponse.json({ error: 'Not enough hunt points' }, { status: 402 });
  }

  const { error: deductError } = await admin
    .from('rpg_profiles')
    .update({ hunt_points: (profile.hunt_points as number) - cost })
    .eq('user_id', user.id);

  if (deductError) return NextResponse.json({ error: deductError.message }, { status: 500 });

  const { data: hunt, error: insertError } = await supabase
    .from('rpg_hunts')
    .insert({ user_id: user.id, rarity, duration_hours: config.duration_hours })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(hunt);
}
