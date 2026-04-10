import type { Set } from '@/lib/types';

/** Oldest logged set first (stable tie-break on id). */
export function sortSetsOldestFirst<T extends Pick<Set, 'created_at' | 'id'>>(sets: T[]): T[] {
  return [...sets].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}
