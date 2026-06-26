'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TripExpense } from '@/lib/firestore-types';
import { mergeSnapshots } from '@/lib/firestore-query/merge-snapshots';
import { syncOlderItemsAfterRemovals } from '@/lib/firestore-query/windowed-list-cache';

const PAGE_SIZE = 50;
const TRIP_ID_CHUNK = 30;

export function useWindowedTripExpenses(userId: string | undefined) {
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [items, setItems] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const liveMapRef = useRef<Map<string, TripExpense>>(new Map());
  const olderItemsRef = useRef<TripExpense[]>([]);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const hasMoreOlderRef = useRef(true);
  const loadingOlderRef = useRef(false);

  const queryTripIds = useMemo(
    () => tripIds.slice(0, TRIP_ID_CHUNK),
    [tripIds]
  );
  const queryTripIdsKey = queryTripIds.join(',');

  const rebuildItems = useCallback(() => {
    setItems(mergeSnapshots(olderItemsRef.current, liveMapRef.current));
  }, []);

  const resetPagination = useCallback(() => {
    liveMapRef.current = new Map();
    olderItemsRef.current = [];
    lastDocRef.current = null;
    hasMoreOlderRef.current = true;
    setHasMoreOlder(true);
    setItems([]);
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!userId) {
      setTripIds([]);
      liveMapRef.current = new Map();
      olderItemsRef.current = [];
      lastDocRef.current = null;
      hasMoreOlderRef.current = false;
      setHasMoreOlder(false);
      setItems([]);
      setLoading(false);
      return;
    }
    resetPagination();
  }, [userId, resetPagination]);

  useEffect(() => {
    if (!userId) return;

    const qTrips = query(
      collection(db, 'trips'),
      or(
        where('createdBy', '==', userId),
        where('members', 'array-contains', userId)
      )
    );

    return onSnapshot(qTrips, (tripSnap) => {
      setTripIds(tripSnap.docs.map((d) => d.id));
    });
  }, [userId]);

  useEffect(() => {
    resetPagination();
  }, [queryTripIdsKey, resetPagination]);

  useEffect(() => {
    if (!userId) return;

    if (queryTripIds.length === 0) {
      liveMapRef.current = new Map();
      olderItemsRef.current = [];
      lastDocRef.current = null;
      hasMoreOlderRef.current = false;
      setHasMoreOlder(false);
      setItems([]);
      setLoading(false);
      return;
    }

    const qExp = query(
      collection(db, 'trip_expenses'),
      where('tripId', 'in', queryTripIds),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(
      qExp,
      (snapshot) => {
        olderItemsRef.current = syncOlderItemsAfterRemovals(
          olderItemsRef.current,
          snapshot.docChanges()
        );

        const map = new Map<string, TripExpense>();
        snapshot.docs.forEach((doc) => {
          map.set(doc.id, { id: doc.id, ...doc.data() } as TripExpense);
        });
        liveMapRef.current = map;

        if (olderItemsRef.current.length === 0) {
          lastDocRef.current =
            snapshot.docs.length > 0
              ? snapshot.docs[snapshot.docs.length - 1]
              : null;
          if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreOlderRef.current = false;
            setHasMoreOlder(false);
          }
        }

        rebuildItems();
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Trip expenses listener error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, queryTripIds, queryTripIdsKey, rebuildItems]);

  const loadOlder = useCallback(async (): Promise<number> => {
    if (
      !userId ||
      queryTripIds.length === 0 ||
      loadingOlderRef.current ||
      !hasMoreOlderRef.current ||
      !lastDocRef.current
    ) {
      return 0;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    try {
      const qExp = query(
        collection(db, 'trip_expenses'),
        where('tripId', 'in', queryTripIds),
        orderBy('date', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(qExp);
      if (snapshot.docs.length === 0) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
        return 0;
      }

      const existingIds = new Set([
        ...olderItemsRef.current.map((item) => item.id),
        ...liveMapRef.current.keys(),
      ]);

      const newItems: TripExpense[] = [];
      snapshot.docs.forEach((doc) => {
        if (!existingIds.has(doc.id)) {
          newItems.push({ id: doc.id, ...doc.data() } as TripExpense);
        }
      });

      olderItemsRef.current = mergeSnapshots(olderItemsRef.current, newItems);
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < PAGE_SIZE) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
      }

      rebuildItems();
      return newItems.length;
    } catch (err) {
      console.error('Load older trip expenses error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return 0;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [userId, queryTripIds, rebuildItems]);

  return {
    items,
    loading,
    error,
    hasMoreOlder,
    loadOlder,
    loadingOlder,
  };
}
