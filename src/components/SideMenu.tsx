'use client';

import { useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { ExportData } from '@/lib/types';

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function SideMenu({ open, onClose }: SideMenuProps) {
  const { theme, toggle } = useTheme();
  const { user, logout, exportData, importData, debugMode, setDebugMode } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bicek-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Wyeksportowano!');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Błąd eksportu');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;
      if (data.version !== 1 || !data.user || !data.exercises) {
        setStatus('Nieprawidłowy plik');
        setTimeout(() => setStatus(null), 3000);
        return;
      }
      await importData(data);
      setStatus('Zaimportowano!');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Błąd importu');
      setTimeout(() => setStatus(null), 3000);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLocal = user?.mode === 'local';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-overlay z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 bottom-0 w-72 bg-panel border-r border-edge z-50
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-edge">
            <div className="text-lg font-black text-ink tracking-tight">
              bicek<span className="text-emerald-500">.</span>
            </div>
            {user && (
              <p className="text-xs text-ink-faint mt-1">
                {isLocal ? 'Tryb lokalny' : 'Online'}
              </p>
            )}
          </div>

          <nav className="flex-1 p-3 space-y-1">
            <button
              onClick={() => { toggle(); }}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm text-ink-soft
                hover:bg-field transition-colors"
            >
              <span>Tryb ciemny</span>
              <div className={`relative w-10 h-[22px] rounded-full transition-colors ${
                theme === 'dark' ? 'bg-emerald-500' : 'bg-edge'
              }`}>
                <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-[3px]'
                }`} />
              </div>
            </button>

            {isLocal && (
              <>
                <div className="h-px bg-edge my-2" />

                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm text-ink-soft
                    hover:bg-field transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                  </svg>
                  Eksportuj dane
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm text-ink-soft
                    hover:bg-field transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v12" />
                  </svg>
                  Importuj dane
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />

                {status && (
                  <p className="text-xs text-center text-emerald-500 py-1">{status}</p>
                )}

                <p className="text-[10px] text-ink-faint px-3 pt-1 leading-relaxed">
                  Dane są w tej przeglądarce. Usunięcie danych przeglądarki spowoduje ich utratę.
                </p>
              </>
            )}
          </nav>

          <div className="p-3 border-t border-edge space-y-1">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm text-ink-faint
                hover:bg-field transition-colors"
            >
              <span>Debug mode</span>
              <div className={`relative w-10 h-[22px] rounded-full transition-colors ${
                debugMode ? 'bg-red-500' : 'bg-edge'
              }`}>
                <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  debugMode ? 'translate-x-[22px]' : 'translate-x-[3px]'
                }`} />
              </div>
            </button>

            <button
              onClick={() => { logout(); onClose(); }}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm text-ink-faint
                hover:bg-field transition-colors text-left"
            >
              <span className="w-5 text-center text-base">→</span>
              Wyloguj
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
