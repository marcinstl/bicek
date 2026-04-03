import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { rollLoot } from '@/lib/rpg/hunts';
import type { RpgRarity } from '@/lib/types';

/** POST /api/rpg/hunt/collect — collects a completed hunt and awards loot. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch active hunt
  const { data: hunt, error: huntError } = await supabase
    .from('rpg_hunts')
    .select('*')
    .eq('user_id', user.id)
    .is('collected_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (huntError) return NextResponse.json({ error: huntError.message }, { status: 500 });
  if (!hunt) return NextResponse.json({ error: 'No active hunt' }, { status: 404 });

  // Verify time has elapsed
  const startMs = new Date(hunt.started_at).getTime();
  const durationMs = hunt.duration_hours * 60 * 60 * 1000;
  if (Date.now() < startMs + durationMs) {
    return NextResponse.json({ error: 'Hunt not finished yet' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();

  // Fetch all items grouped by rarity (service role bypasses RLS)
  const { data: allItems, error: itemsError } = await admin
    .from('rpg_items')
    .select('id, rarity, name, eq_slot, spritesheet_path, sprite_positions, buffs')
    .not('sprite_positions', 'is', null);

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const itemsByRarity: Record<RpgRarity, string[]> = {
    common: [], uncommon: [], rare: [], epic: [], legendary: [],
  };
  for (const item of allItems ?? []) {
    if (Array.isArray(item.sprite_positions) && item.sprite_positions.length > 0) {
      itemsByRarity[(item.rarity as RpgRarity) ?? 'common'].push(item.id);
    }
  }

  const rewardItemIds = rollLoot(hunt.rarity as RpgRarity, itemsByRarity);

  // Insert rewards into rpg_inventory with equipped=false
  if (rewardItemIds.length > 0) {
    const { error: inventoryError } = await admin
      .from('rpg_inventory')
      .insert(
        rewardItemIds.map((item_id) => ({
          user_id: user.id,
          item_id,
          equipped: false,
        })),
      );
    if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 });
  }

  // Mark hunt as collected
  const { error: updateError } = await admin
    .from('rpg_hunts')
    .update({ collected_at: new Date().toISOString(), reward_item_ids: rewardItemIds })
    .eq('id', hunt.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Return full item data for the reward modal — one entry per reward_item_ids slot (duplicates preserved)
  const itemMap = new Map((allItems ?? []).map((i) => [i.id, i]));
  const rewardItems = rewardItemIds.map((id) => itemMap.get(id)).filter(Boolean);

  return NextResponse.json({ reward_item_ids: rewardItemIds, items: rewardItems });
}
