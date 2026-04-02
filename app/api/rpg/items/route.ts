import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { rowsToRequirements } from '@/lib/rpg/requirements';
import type { RpgRequirement } from '@/lib/types';

function sanitizeRequirements(reqs: RpgRequirement[]): RpgRequirement[] {
  return reqs.map((req) =>
    'secret' in req && req.secret ? ({ type: 'secret' } satisfies RpgRequirement) : req
  );
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [itemsResult, discoveriesResult] = await Promise.all([
    supabase
      .from('rpg_items')
      .select('id,eq_slot,spritesheet_path,name,type,sprite_positions,rpg_item_requirements(type,level,kind,xp,count,secret)')
      .not('sprite_positions', 'is', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('rpg_item_discoveries')
      .select('item_id')
      .eq('user_id', user.id),
  ]);

  if (itemsResult.error) return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });

  const discoveredIds = new Set((discoveriesResult.data ?? []).map((d) => d.item_id));

  const items = (itemsResult.data ?? [])
    .filter((item) => Array.isArray(item.sprite_positions) && (item.sprite_positions as unknown[]).length > 0)
    .map((item) => {
    const isDiscovered = discoveredIds.has(item.id);
    const reqs = rowsToRequirements(
      Array.isArray(item.rpg_item_requirements) ? item.rpg_item_requirements : []
    );
    return {
      id: item.id,
      eq_slot: item.eq_slot,
      spritesheet_path: item.spritesheet_path,
      name: isDiscovered ? item.name : null,
      item_type: isDiscovered ? item.type : null,
      requirements: sanitizeRequirements(reqs),
      sprite_positions: item.sprite_positions as import('@/lib/types').SpritePosition[],
    };
  });

  return NextResponse.json(items);
}
