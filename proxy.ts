import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPath = pathname === '/login' || pathname === '/signup';
  const isWaitingPath = pathname === '/waiting';

  // Not logged in → send to login
  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Logged in on auth page → send to plans
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/plans';
    return NextResponse.redirect(url);
  }

  // Logged in but on app pages → check is_active
  if (user && !isAuthPath && !isWaitingPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (!profile?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = '/waiting';
      return NextResponse.redirect(url);
    }
  }

  // Logged in, active, on /waiting → send to plans
  if (user && isWaitingPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (profile?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = '/plans';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
