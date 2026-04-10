import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="mt-1 text-sm text-gray-500">Narzędzia tylko na localhost.</p>
        <nav className="mt-8 flex flex-col gap-3">
          <Link
            href="/admin/items"
            className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            Items
          </Link>
          <Link
            href="/admin/skill-tree"
            className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            Skill Tree
          </Link>
        </nav>
      </div>
    </div>
  );
}
