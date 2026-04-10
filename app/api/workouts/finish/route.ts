import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server';

/** POST /api/workouts/finish — ends workout and awards hunt_points (minutes trained, capped). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

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

  const admin = createAdminSupabaseClient();
  const endedAt = new Date().toISOString();

  const { data: finished, error: finishError } = await admin
    .from('workouts')
    .update({ ended_at: endedAt })
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .select()
    .maybeSingle();

  if (finishError) return NextResponse.json({ error: finishError.message }, { status: 500 });

  if (!finished) {
    const { data: existing, error: readError } = await admin
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    return NextResponse.json(existing);
  }

  const startedMs = new Date(finished.started_at).getTime();
  const endedMs = new Date(endedAt).getTime();
  const durationMinutes = Math.max(0, (endedMs - startedMs) / 60_000);

  if (durationMinutes > 0) {
    const { data: profile, error: profileError } = await admin
      .from('rpg_profiles')
      .select('hunt_points, hunt_points_maximum')
      .eq('user_id', user.id)
      .single();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    const current = Number(profile?.hunt_points ?? 0);
    const maximum = Number(profile?.hunt_points_maximum ?? 420);
    const next = Math.min(current + durationMinutes, maximum);

    const { error: updateHpError } = await admin
      .from('rpg_profiles')
      .update({ hunt_points: next })
      .eq('user_id', user.id);

    if (updateHpError) return NextResponse.json({ error: updateHpError.message }, { status: 500 });
  }

  return NextResponse.json(finished);
}
