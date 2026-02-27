'use client';

import { Suspense } from 'react';
import { AppProvider, useApp } from '@/hooks/useApp';
import { ThemeProvider } from '@/hooks/useTheme';
import AuthScreen from '@/components/AuthScreen';
import Dashboard from '@/components/Dashboard';

function AppContent() {
  const app = useApp();

  if (app.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-ink-faint text-sm animate-pulse">Ładowanie...</div>
      </div>
    );
  }

  if (!app.user) {
    return <AuthScreen />;
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-ink-faint text-sm animate-pulse">Ładowanie...</div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}
