'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/api';
import { enableOfflineMode } from '@/lib/api-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GoogleButton } from '@/components/ui/GoogleButton';

const offlineModeEnabled = process.env.NEXT_PUBLIC_OFFLINE_MODE === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleOfflineLogin() {
    enableOfflineMode();
    router.push('/plans');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-1">
            BICEK<span className="text-emerald-500">.</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <GoogleButton label="Sign in with Google" />

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-emerald-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>

        {offlineModeEnabled && (
          <div className="mt-6 border-t border-dashed border-gray-200 pt-5">
            <p className="text-center text-xs text-gray-400 mb-3 font-mono">DEV ONLY</p>
            <button
              onClick={handleOfflineLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Continue offline (IndexedDB)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
