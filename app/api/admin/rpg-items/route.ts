import { isLocalhostHostHeader } from '@/lib/admin-localhost';
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host');
  if (!isLocalhostHostHeader(host)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('rpg_items')
    .select('*, rpg_item_requirements(*)')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
