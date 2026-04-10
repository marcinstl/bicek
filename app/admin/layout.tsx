import { isLocalhostHostHeader } from '@/lib/admin-localhost';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = h.get('host') ?? h.get('x-forwarded-host');
  if (!isLocalhostHostHeader(host)) notFound();
  return <>{children}</>;
}
