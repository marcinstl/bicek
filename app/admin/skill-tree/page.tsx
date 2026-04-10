'use client';

import Link from 'next/link';
import SkillTreeEditor from './SkillTreeEditor';

export default function AdminSkillTreePage() {
  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin"
            className="shrink-0 text-sm font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            ← Admin
          </Link>
          <h1 className="truncate text-sm font-semibold text-white">Skill Tree — edytor</h1>
        </div>
        <p className="hidden text-[11px] text-slate-500 sm:block">localhost · bez zapisu DB</p>
      </header>
      <div className="min-h-0 flex-1">
        <SkillTreeEditor />
      </div>
    </div>
  );
}
