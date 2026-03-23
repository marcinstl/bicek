import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/plans';

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Fallback for OAuth users in case DB trigger didn't create profile row.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('profiles').upsert(
        { id: user.id },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
