import type { DocumentChange, DocumentData } from 'firebase/firestore';
import {
  mergeSnapshots,
  upsertIntoSnapshotMap,
  type MergeableSnapshotItem,
} from '@/lib/firestore-query/merge-snapshots';

export type WindowedCacheState<T> = {
  liveMap: Map<string, T>;
  olderItems: T[];
};

export function captureWindowedState<T>(
  liveMap: Map<string, T>,
  olderItems: T[]
): WindowedCacheState<T> {
  return {
    liveMap: new Map(liveMap),
    olderItems: [...olderItems],
  };
}

export function syncOlderItemsAfterRemovals<T extends { id?: string }>(
  olderItems: T[],
  changes: DocumentChange<DocumentData>[]
): T[] {
  const removedIds = changes
    .filter((change) => change.type === 'removed')
    .map((change) => change.doc.id);
  if (removedIds.length === 0) return olderItems;
  const removed = new Set(removedIds);
  return olderItems.filter((item) => item.id && !removed.has(item.id));
}

export function purgeWindowedId<T extends { id?: string }>(
  liveMap: Map<string, T>,
  olderItems: T[],
  id: string
): WindowedCacheState<T> {
  const nextLive = new Map(liveMap);
  nextLive.delete(id);
  return {
    liveMap: nextLive,
    olderItems: olderItems.filter((item) => item.id !== id),
  };
}

export function upsertWindowedItem<T extends MergeableSnapshotItem>(
  liveMap: Map<string, T>,
  olderItems: T[],
  item: T
): WindowedCacheState<T> {
  const id = item.id;
  if (!id) return { liveMap, olderItems };

  const nextLive = liveMap.has(id)
    ? upsertIntoSnapshotMap(liveMap, [item])
    : liveMap;

  const nextOlder = mergeSnapshots(
    olderItems.filter((entry) => entry.id !== id),
    [item]
  );

  return { liveMap: nextLive, olderItems: nextOlder };
}
