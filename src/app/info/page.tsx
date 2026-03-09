import Link from 'next/link';
import InfoPageContent from '@/components/InfoPageContent';
import { ChevronLeft } from 'lucide-react';

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-base pb-20">
      <header className="sticky top-0 z-40 bg-header-bg backdrop-blur-xl border-b border-edge">
        <div className="max-w-sm md:max-w-[600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-field transition-colors text-ink-soft"
            aria-label="Wróć"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-black text-ink tracking-tight">
            O aplikacji
          </h1>
        </div>
      </header>
      <main className="max-w-sm md:max-w-[600px] mx-auto px-4 py-6">
        <InfoPageContent />
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-500 hover:text-emerald-400"
          >
            <ChevronLeft className="w-4 h-4" />
            Wróć do BICEK
          </Link>
        </div>
      </main>
    </div>
  );
}
