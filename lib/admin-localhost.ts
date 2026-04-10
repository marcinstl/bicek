/** True when the request Host is loopback (admin UI + /api/admin only on localhost). */
export function isLocalhostHostHeader(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(',')[0].trim().toLowerCase();
  if (h === 'localhost' || h.startsWith('localhost:')) return true;
  if (h === '127.0.0.1' || h.startsWith('127.0.0.1:')) return true;
  if (h === '[::1]' || h.startsWith('[::1]:')) return true;
  return false;
}
