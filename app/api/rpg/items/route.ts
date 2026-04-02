import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { RpgRequirement } from '@/lib/types';

type RawRequirement = {
  type: string;
  level?: number;
  kind?: string;
  xp?: number;
  count?: number;
  secret?: boolean;
};

function sanitizeRequirements(raw: unknown): RpgRequirement[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawRequirement[]).map((req) => {
    if (req.secret) {
      return { type: 'secret' } satisfies RpgRequirement;
    }
    const { secret: _s, ...rest } = req;
    return rest as RpgRequirement;
  });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [itemsResult, discoveriesResult] = await Promise.all([
    supabase
      .from('rpg_items')
      .select('id,eq_slot,icon_path,name,type,requirements')
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
    return {
      id: item.id,
      eq_slot: item.eq_slot,
      icon_path: item.icon_path,
      name: isDiscovered ? item.name : null,
      item_type: isDiscovered ? item.type : null,
      requirements: sanitizeRequirements(item.requirements),
    };
  });

  return NextResponse.json(items);
}
