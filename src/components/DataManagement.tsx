'use client';

import { useRef, useState } from 'react';
import { useApp } from '@/hooks/useApp';
import { ExportData } from '@/lib/types';

export default function DataManagement() {
  const { user, exportData, importData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!user || user.mode !== 'local') return null;

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
        return;
      }
      await importData(data);
      setStatus('Zaimportowano!');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Błąd importu');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <h3 className="text-xs text-ink-faint uppercase tracking-wider font-medium">
        Dane lokalne
      </h3>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 py-2 text-xs font-medium text-ink-soft bg-field rounded-xl
            border border-edge hover:bg-edge transition-colors"
        >
          Eksportuj JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 text-xs font-medium text-ink-soft bg-field rounded-xl
            border border-edge hover:bg-edge transition-colors"
        >
          Importuj JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {status && (
        <p className="text-xs text-center text-emerald-500">{status}</p>
      )}

      <p className="text-[10px] text-ink-faint text-center leading-relaxed">
        Dane są przechowywane tylko w tej przeglądarce.
        Usunięcie danych przeglądarki spowoduje ich utratę.
      </p>
    </div>
  );
}
