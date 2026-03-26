'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/api';
import { isOfflineMode, disableOfflineMode, triggerXpBackfillBatch } from '@/lib/api-router';
import { WorkoutTimerProvider, useWorkoutTimer, formatDuration } from '@/components/providers/WorkoutTimerContext';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/plans',
    label: 'Plans',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/history',
    label: 'History',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/rpg',
    label: 'RPG',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
];

function AppHeader() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [offline, setOffline] = useState(false);
  const { activeWorkoutId, activePlanId, elapsed } = useWorkoutTimer();

  useEffect(() => {
    setIsClient(true);
    setOffline(isOfflineMode());
  }, []);

  async function handleSignOut() {
    if (offline) {
      disableOfflineMode();
      router.push('/login');
      return;
    }
    await signOut();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-40 bg-white/75 backdrop-blur-md border-b border-gray-200/50 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-300/50 to-transparent" />
      <div className="relative max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/plans" className="flex items-center font-black tracking-tight text-gray-900 text-xl">
            BICEK<span className="text-emerald-500">.</span>
          </Link>

          {activeWorkoutId && activePlanId && (
            <Link
              href={`/plans/${activePlanId}/workout?workoutId=${activeWorkoutId}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-mono font-semibold text-emerald-700 tabular-nums">
                {formatDuration(elapsed)}
              </span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isClient && offline && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              offline
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOfflineMode()) return;
    if (sessionStorage.getItem('xp-backfill-done') === 'true') return;

    void (async () => {
      try {
        let totalProcessed = 0;
        for (let i = 0; i < 8; i += 1) {
          const { processed } = await triggerXpBackfillBatch();
          totalProcessed += processed;
          if (processed === 0) break;
        }
        if (totalProcessed >= 0) {
          sessionStorage.setItem('xp-backfill-done', 'true');
        }
      } catch {
        // Non-blocking maintenance task: ignore and retry on next app open.
      }
    })();
  }, []);

  return (
    <WorkoutTimerProvider>
      <div className="relative z-10 min-h-screen flex flex-col">
        <AppHeader />

        {/* Main */}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="sticky bottom-0 z-40 bg-white/80 backdrop-blur-md border-t border-gray-200/60 shadow-[0_-8px_32px_-12px_rgba(15,23,42,0.06)] safe-bottom">
          <div className="max-w-2xl mx-auto flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-medium transition-colors',
                    active ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-700'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </WorkoutTimerProvider>
  );
}
