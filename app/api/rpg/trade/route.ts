import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server';

/** POST /api/rpg/trade — sell one inventory stack for fragments (atomic via RPC). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let inventoryRowId: string | undefined;
  try {
    const body = (await req.json()) as { inventoryRowId?: string };
    inventoryRowId = body.inventoryRowId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!inventoryRowId) {
    return NextResponse.json({ error: 'inventoryRowId is required' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: raw, error: rpcError } = await admin.rpc('rpg_trade_inventory_row', {
    p_row_id: inventoryRowId,
    p_user_id: user.id,
  });

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

  const result = raw as { error?: string; ok?: boolean; item_rarity?: string } | null;
  if (result?.error === 'not_found') {
    return NextResponse.json({ error: 'Nie znaleziono przedmiotu' }, { status: 404 });
  }
  if (result?.error === 'equipped') {
    return NextResponse.json({ error: 'Zdejmij przedmiot z ekwipunku przed sprzedaza' }, { status: 400 });
  }
  if (result?.error === 'locked') {
    return NextResponse.json(
      { error: 'Zwolnij miejsce w plecaku — ta nagroda czeka na odbiór' },
      { status: 400 },
    );
  }
  if (!result?.ok) {
    return NextResponse.json({ error: 'Trade failed' }, { status: 500 });
  }

  const { data: profile } = await admin
    .from('rpg_profiles')
    .select(
      'fragments_common, fragments_uncommon, fragments_rare, fragments_epic, fragments_legendary'
    )
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    itemRarity: result.item_rarity,
    fragments: profile,
  });
}
