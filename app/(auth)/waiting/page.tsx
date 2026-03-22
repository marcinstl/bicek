'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function WaitingPage() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
          <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for access</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Your account has been created but is pending activation.<br />
          Contact the administrator to get access.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">What happens next?</p>
          <ul className="flex flex-col gap-2">
            {[
              'Your account is registered in the system',
              'The admin will review and activate your account',
              'Once activated, you can sign in and start tracking',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        <Button variant="ghost" onClick={handleSignOut} className="w-full text-gray-500">
          Sign out
        </Button>
      </div>
    </div>
  );
}
