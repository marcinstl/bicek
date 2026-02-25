import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'bicek - Habit Tracker',
  description: 'Buduj nawyki treningowe. Krok po kroku.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
