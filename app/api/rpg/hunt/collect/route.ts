import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { rollLoot } from '@/lib/rpg/hunts';
import type { RpgRarity } from '@/lib/types';

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

type RewardPayload = ReturnType<typeof rewardItemShape> & { stashed: boolean };

async function countUnequippedUnlocked(admin: AdminClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('rpg_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('equipped', false)
    .eq('locked', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function maxBagSize(admin: AdminClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from('rpg_profiles')
    .select('max_inventory_size')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.max_inventory_size ?? 20;
}

async function countLockedPendingForHunt(admin: AdminClient, userId: string, huntId: string): Promise<number> {
  const { count, error } = await admin
    .from('rpg_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('pending_hunt_id', huntId)
    .eq('locked', true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countAnyPendingForHunt(admin: AdminClient, userId: string, huntId: string): Promise<number> {
  const { count, error } = await admin
    .from('rpg_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('pending_hunt_id', huntId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function finalizeHuntDelivery(admin: AdminClient, userId: string, huntId: string): Promise<void> {
  const { error: invErr } = await admin
    .from('rpg_inventory')
    .update({ pending_hunt_id: null })
    .eq('user_id', userId)
    .eq('pending_hunt_id', huntId);
  if (invErr) throw new Error(invErr.message);
  const { error: huntErr } = await admin
    .from('rpg_hunts')
    .update({ collected_at: new Date().toISOString() })
    .eq('id', huntId)
    .is('collected_at', null);
  if (huntErr) throw new Error(huntErr.message);
}

function rewardItemShape(item: {
  id: string;
  rarity: string | null;
  name: string | null;
  eq_slot: string;
  spritesheet_path: string | null;
  sprite_positions: unknown;
  buffs: unknown;
}) {
  return {
    id: item.id,
    rarity: item.rarity,
    name: item.name,
    eq_slot: item.eq_slot,
    spritesheet_path: item.spritesheet_path,
    sprite_positions: item.sprite_positions,
    buffs: item.buffs,
  };
}

async function listPendingHuntRewards(
  admin: AdminClient,
  userId: string,
  huntId: string,
  itemMap: Map<
    string,
    {
      id: string;
      rarity: string | null;
      name: string | null;
      eq_slot: string;
      spritesheet_path: string | null;
      sprite_positions: unknown;
      buffs: unknown;
    }
  >,
): Promise<RewardPayload[]> {
  const { data, error } = await admin
    .from('rpg_inventory')
    .select('item_id, locked')
    .eq('user_id', userId)
    .eq('pending_hunt_id', huntId)
    .order('equipped_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const item = itemMap.get(row.item_id);
    if (!item) throw new Error('Hunt reward item missing from catalog');
    return { ...rewardItemShape(item), stashed: row.locked === true };
  });
}

function jsonBody(allRewards: RewardPayload[], itemsThisRound: RewardPayload[], lockedRemaining: number) {
  return NextResponse.json({
    allRewards,
    items: itemsThisRound.map(({ stashed, ...rest }) => rest),
    lockedRemaining,
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** POST /api/rpg/hunt/collect — hunt loot is all-or-nothing: need bag space for the whole batch at once. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const startMs = new Date(hunt.started_at).getTime();
  const durationMs = hunt.duration_minutes * 60 * 1000;
  if (Date.now() < startMs + durationMs) {
    return NextResponse.json({ error: 'Hunt not finished yet' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();

  const { data: allItems, error: itemsError } = await admin
    .from('rpg_items')
    .select('id, rarity, name, eq_slot, spritesheet_path, sprite_positions, buffs')
    .not('sprite_positions', 'is', null);

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const itemMap = new Map((allItems ?? []).map((i) => [i.id, i]));

  const { data: claimed, error: claimError } = await admin
    .from('rpg_hunts')
    .update({ loot_rolled_at: new Date().toISOString() })
    .eq('id', hunt.id)
    .is('collected_at', null)
    .is('loot_rolled_at', null)
    .select('id')
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const wonFirstCollectClaim = !!claimed;

  try {
    if (wonFirstCollectClaim) {
      const itemsByRarity: Record<RpgRarity, string[]> = {
        common: [],
        uncommon: [],
        rare: [],
        epic: [],
        legendary: [],
      };
      for (const item of allItems ?? []) {
        if (Array.isArray(item.sprite_positions) && item.sprite_positions.length > 0) {
          itemsByRarity[(item.rarity as RpgRarity) ?? 'common'].push(item.id);
        }
      }

      const rewardItemIds = rollLoot(hunt.rarity as RpgRarity, itemsByRarity);

      if (rewardItemIds.length === 0) {
        await finalizeHuntDelivery(admin, user.id, hunt.id);
        return NextResponse.json({ allRewards: [], items: [], lockedRemaining: 0 });
      }

      const freeSlots = Math.max(0, (await maxBagSize(admin, user.id)) - (await countUnequippedUnlocked(admin, user.id)));
      const n = rewardItemIds.length;
      const wholeBatchFits = freeSlots >= n;

      const rows = rewardItemIds.map((item_id) => ({
        user_id: user.id,
        item_id,
        equipped: false,
        locked: !wholeBatchFits,
        pending_hunt_id: hunt.id,
      }));

      const { error: inventoryError } = await admin.from('rpg_inventory').insert(rows);
      if (inventoryError) {
        await admin.from('rpg_hunts').update({ loot_rolled_at: null }).eq('id', hunt.id);
        return NextResponse.json({ error: inventoryError.message }, { status: 500 });
      }

      const lockedRemaining = await countLockedPendingForHunt(admin, user.id, hunt.id);
      if (lockedRemaining === 0) {
        await finalizeHuntDelivery(admin, user.id, hunt.id);
      }

      const allRewards: RewardPayload[] = rewardItemIds.map((id) => {
        const item = itemMap.get(id);
        if (!item) throw new Error('Hunt reward item missing from catalog');
        return { ...rewardItemShape(item), stashed: !wholeBatchFits };
      });

      const itemsThisRound: RewardPayload[] = wholeBatchFits ? allRewards : [];

      return jsonBody(allRewards, itemsThisRound, lockedRemaining);
    }

    const { data: huntNow, error: huntNowErr } = await admin
      .from('rpg_hunts')
      .select('id, collected_at, loot_rolled_at')
      .eq('id', hunt.id)
      .single();
    if (huntNowErr) throw new Error(huntNowErr.message);
    if (huntNow?.collected_at) {
      return NextResponse.json({ error: 'Hunt already collected' }, { status: 400 });
    }

    let lockedCount = await countLockedPendingForHunt(admin, user.id, hunt.id);

    if (lockedCount === 0) {
      let pendingTotal = await countAnyPendingForHunt(admin, user.id, hunt.id);
      if (pendingTotal === 0 && huntNow?.loot_rolled_at) {
        for (let i = 0; i < 8 && pendingTotal === 0; i++) {
          await sleep(75);
          pendingTotal = await countAnyPendingForHunt(admin, user.id, hunt.id);
        }
      }
      if (pendingTotal === 0 && huntNow?.loot_rolled_at) {
        await admin.from('rpg_hunts').update({ loot_rolled_at: null }).eq('id', hunt.id);
        return NextResponse.json({ error: 'Spróbuj ponownie' }, { status: 409 });
      }
      if (pendingTotal > 0) {
        const allRewards = (await listPendingHuntRewards(admin, user.id, hunt.id, itemMap)).map((r) => ({
          ...r,
          stashed: false,
        }));
        await finalizeHuntDelivery(admin, user.id, hunt.id);
        return jsonBody(allRewards, allRewards, 0);
      }
      return NextResponse.json({ allRewards: [], items: [], lockedRemaining: 0 });
    }

    const allRewardsPreview = await listPendingHuntRewards(admin, user.id, hunt.id, itemMap);

    const freeSlots = Math.max(0, (await maxBagSize(admin, user.id)) - (await countUnequippedUnlocked(admin, user.id)));

    if (freeSlots < lockedCount) {
      return jsonBody(allRewardsPreview, [], lockedCount);
    }

    const { data: lockedRowsRaw, error: lockedSelErr } = await admin
      .from('rpg_inventory')
      .select('id, item_id')
      .eq('user_id', user.id)
      .eq('pending_hunt_id', hunt.id)
      .eq('locked', true)
      .order('equipped_at', { ascending: true })
      .order('id', { ascending: true });
    if (lockedSelErr) throw new Error(lockedSelErr.message);

    const lockedRows = lockedRowsRaw ?? [];
    if (lockedRows.length === 0) {
      lockedCount = await countLockedPendingForHunt(admin, user.id, hunt.id);
      if (lockedCount > 0) {
        return NextResponse.json(
          { error: 'Nie udało się odczytać kolejki nagród — odśwież i spróbuj ponownie' },
          { status: 500 },
        );
      }
      return NextResponse.json({ allRewards: [], items: [], lockedRemaining: 0 });
    }

    const { error: upErr } = await admin
      .from('rpg_inventory')
      .update({ locked: false })
      .in(
        'id',
        lockedRows.map((r) => r.id),
      );
    if (upErr) throw new Error(upErr.message);

    const lockedRemaining = await countLockedPendingForHunt(admin, user.id, hunt.id);
    if (lockedRemaining === 0) {
      await finalizeHuntDelivery(admin, user.id, hunt.id);
    }

    const itemsThisRound = lockedRows
      .map((r) => itemMap.get(r.item_id))
      .filter(Boolean)
      .map((i) => ({ ...rewardItemShape(i!), stashed: false as const }));

    const allRewardsDelivered = allRewardsPreview.map((r) => ({ ...r, stashed: false }));

    return jsonBody(allRewardsDelivered, itemsThisRound, lockedRemaining);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Collect failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
