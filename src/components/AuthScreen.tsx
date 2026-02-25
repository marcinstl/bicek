'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/useApp';
import { useTheme } from '@/hooks/useTheme';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function AuthScreen() {
  const { loginLocal, loginEmail, signupEmail, loginGoogle } = useApp();
  const { theme, toggle } = useTheme();
  const [showEmail, setShowEmail] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const supabaseReady = isSupabaseConfigured();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isSignup) {
        await signupEmail(email, password);
        setSuccess('Sprawdź swoją skrzynkę email, aby potwierdzić konto.');
      } else {
        await loginEmail(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-5xl font-black tracking-tight text-ink">
            BICEK<span className="text-emerald-500">.</span>
          </div>
          <p className="text-ink-faint text-sm tracking-wide uppercase">
            Buduj nawyki. Krok po kroku.
          </p>
        </div>

        {!showEmail ? (
          <div className="space-y-3">
            {supabaseReady && (
              <>
                <button
                  onClick={() => setShowEmail(true)}
                  className="w-full py-3.5 px-4 bg-ink text-base rounded-xl font-semibold text-sm
                    hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Zaloguj się przez email
                </button>
                <button
                  onClick={loginGoogle}
                  className="w-full py-3.5 px-4 bg-field text-ink rounded-xl font-semibold text-sm
                    border border-edge hover:opacity-80 transition-all active:scale-[0.98]"
                >
                  Kontynuuj z Google
                </button>
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-edge" />
                  <span className="text-ink-faint text-xs uppercase tracking-wider">lub</span>
                  <div className="flex-1 h-px bg-edge" />
                </div>
              </>
            )}
            <button
              onClick={loginLocal}
              className="w-full py-3.5 px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-semibold text-sm
                border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
            >
              Tryb lokalny (bez konta)
            </button>
            <p className="text-ink-faint text-xs text-center px-4 leading-relaxed">
              Dane są przechowywane tylko w tej przeglądarce.
              Usunięcie danych przeglądarki spowoduje ich utratę.
            </p>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full py-3 px-4 bg-field border border-edge rounded-xl text-ink
                  placeholder:text-ink-faint text-sm focus:outline-none focus:border-emerald-500/50
                  focus:ring-1 focus:ring-emerald-500/20"
              />
              <input
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full py-3 px-4 bg-field border border-edge rounded-xl text-ink
                  placeholder:text-ink-faint text-sm focus:outline-none focus:border-emerald-500/50
                  focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}
            {success && (
              <p className="text-emerald-500 text-xs text-center">{success}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-emerald-500 text-white rounded-xl font-semibold text-sm
                hover:bg-emerald-400 transition-all active:scale-[0.98]"
            >
              {isSignup ? 'Zarejestruj się' : 'Zaloguj się'}
            </button>

            <div className="flex justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-ink-faint hover:text-ink-soft transition-colors"
              >
                {isSignup ? 'Mam już konto' : 'Utwórz konto'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="text-ink-faint hover:text-ink-soft transition-colors"
              >
                Wróć
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <button
            onClick={toggle}
            className="text-ink-faint text-xs hover:text-ink-soft transition-colors"
          >
            {theme === 'dark' ? '☀️ Tryb jasny' : '🌙 Tryb ciemny'}
          </button>
        </div>
      </div>
    </div>
  );
}
