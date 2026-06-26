import {
  toDateFromFirestore,
  type FirestoreDateLike,
} from '@/lib/datetime';

/** Minimal shape for merging Firestore snapshot rows by id and date. */
export type MergeableSnapshotItem = {
  id?: string;
  date: FirestoreDateLike;
};

function addSource<T extends MergeableSnapshotItem>(
  map: Map<string, T>,
  source: T[] | Map<string, T>
): void {
  if (source instanceof Map) {
    for (const [id, item] of source) {
      map.set(id, item);
    }
    return;
  }

  for (const item of source) {
    const id = item.id;
    if (!id) continue;
    map.set(id, item);
  }
}

/**
 * Merge multiple snapshot batches into one deduplicated list sorted by date descending.
 * Later sources overwrite earlier entries for the same document id.
 */
export function mergeSnapshots<T extends MergeableSnapshotItem>(
  ...sources: (T[] | Map<string, T>)[]
): T[] {
  const byId = new Map<string, T>();

  for (const source of sources) {
    addSource(byId, source);
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = toDateFromFirestore(a.date)?.getTime() ?? 0;
    const bTime = toDateFromFirestore(b.date)?.getTime() ?? 0;
    return bTime - aTime;
  });
}

/**
 * Insert or replace items in an existing id map (for incremental listener updates).
 */
export function upsertIntoSnapshotMap<T extends MergeableSnapshotItem>(
  map: Map<string, T>,
  items: T[]
): Map<string, T> {
  const next = new Map(map);
  for (const item of items) {
    const id = item.id;
    if (!id) continue;
    next.set(id, item);
  }
  return next;
}

/**
 * Remove document ids from a snapshot map (for listener `removed` changes).
 */
export function removeFromSnapshotMap<T>(
  map: Map<string, T>,
  ids: string[]
): Map<string, T> {
  const next = new Map(map);
  for (const id of ids) {
    next.delete(id);
  }
  return next;
}
