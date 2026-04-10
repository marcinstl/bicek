import { redirect } from 'next/navigation';

/** @deprecated Use `/admin/items`. */
export default function AdminRpgRedirectPage() {
  redirect('/admin/items');
}
