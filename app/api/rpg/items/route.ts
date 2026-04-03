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

  const [itemsResult, inventoryResult] = await Promise.all([
    supabase
      .from('rpg_items')
      .select('id,eq_slot,spritesheet_path,name,type,sprite_positions,buffs,rarity,rpg_item_requirements(type,level,kind,xp,count,secret)')
      .not('sprite_positions', 'is', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('rpg_inventory')
      .select('item_id')
      .eq('user_id', user.id),
  ]);

  if (itemsResult.error) return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });

  // Any item the user owns (equipped or in bag) is "discovered" — full details visible.
  const ownedItemIds = new Set((inventoryResult.data ?? []).map((r) => r.item_id));

  const items = (itemsResult.data ?? [])
    .filter((item) => Array.isArray(item.sprite_positions) && (item.sprite_positions as unknown[]).length > 0)
    .map((item) => {
      const isOwned = ownedItemIds.has(item.id);
      const reqs = rowsToRequirements(
        Array.isArray(item.rpg_item_requirements) ? item.rpg_item_requirements : []
      );
      return {
        id: item.id,
        eq_slot: item.eq_slot,
        spritesheet_path: item.spritesheet_path,
        rarity: item.rarity as import('@/lib/types').RpgRarity,
        name: isOwned ? item.name : null,
        item_type: isOwned ? item.type : null,
        requirements: sanitizeRequirements(reqs),
        sprite_positions: item.sprite_positions as import('@/lib/types').SpritePosition[],
        buffs: isOwned ? (item.buffs as import('@/lib/types').RpgItemBuff[] ?? []) : [],
      };
    });

  return NextResponse.json(items);
}
