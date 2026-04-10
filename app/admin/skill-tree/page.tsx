import Link from 'next/link';

export default function AdminSkillTreePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/admin"
          className="text-sm font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
        >
          ← Admin
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">Skill Tree</h1>
        <p className="mt-2 text-sm text-gray-500">Edytor drzewka — wkrótce.</p>
      </div>
    </div>
  );
}
