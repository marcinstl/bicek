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
      .select('id,eq_slot,icon_path,name,type,rpg_item_requirements(type,level,kind,xp,count,secret)')
      .order('created_at', { ascending: true }),
    supabase
      .from('rpg_item_discoveries')
      .select('item_id')
      .eq('user_id', user.id),
  ]);

  if (itemsResult.error) return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });

  const discoveredIds = new Set((discoveriesResult.data ?? []).map((d) => d.item_id));

  const items = (itemsResult.data ?? []).map((item) => {
    const isDiscovered = discoveredIds.has(item.id);
    const reqs = rowsToRequirements(
      Array.isArray(item.rpg_item_requirements) ? item.rpg_item_requirements : []
    );
    return {
      id: item.id,
      eq_slot: item.eq_slot,
      icon_path: item.icon_path,
      name: isDiscovered ? item.name : null,
      item_type: isDiscovered ? item.type : null,
      requirements: sanitizeRequirements(reqs),
    };
  });

  return NextResponse.json(items);
}
