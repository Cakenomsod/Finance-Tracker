'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  or,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TripExpense, Transaction } from '@/lib/firestore-types';
import type { DateWindow } from '@/lib/firestore-query/types';
import {
  buildInitial6MonthWindow,
  buildOlder6MonthWindow,
} from '@/lib/firestore-query/date-windows';
import { mergeSnapshots } from '@/lib/firestore-query/merge-snapshots';
import { toDateFromFirestore } from '@/lib/datetime';

const TRIP_ID_CHUNK = 30;

function isInAnyWindow(
  date: Transaction['date'],
  windows: DateWindow[]
): boolean {
  const d = toDateFromFirestore(date);
  if (!d) return false;
  return windows.some((w) => d >= w.start && d <= w.end);
}

export function useDashboardData(userId: string | undefined) {
  const [windows, setWindows] = useState<DateWindow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoadingOlder, setChartLoadingOlder] = useState(false);
  const [hasOlderChartData, setHasOlderChartData] = useState(true);
  const [tripIds, setTripIds] = useState<string[]>([]);

  const txWindowMapsRef = useRef<Map<string, Map<string, Transaction>>>(
    new Map()
  );
  const expChunkMapsRef = useRef<Map<string, Map<string, TripExpense>>>(
    new Map()
  );

  useEffect(() => {
    if (!userId) {
      setWindows([]);
      setTransactions([]);
      setTripExpenses([]);
      setTripIds([]);
      setLoading(false);
      txWindowMapsRef.current.clear();
      expChunkMapsRef.current.clear();
      return;
    }
    txWindowMapsRef.current.clear();
    expChunkMapsRef.current.clear();
    setWindows([buildInitial6MonthWindow()]);
    setHasOlderChartData(true);
    setLoading(true);
  }, [userId]);

  const mergeTxFromRefs = useCallback(() => {
    const sources = [...txWindowMapsRef.current.values()];
    setTransactions(mergeSnapshots(...sources));
  }, []);

  const mergeExpFromRefs = useCallback((activeWindows: DateWindow[]) => {
    const byId = new Map<string, TripExpense>();
    for (const map of expChunkMapsRef.current.values()) {
      for (const [id, ex] of map) {
        if (isInAnyWindow(ex.date, activeWindows)) {
          byId.set(id, ex);
        }
      }
    }
    setTripExpenses(mergeSnapshots(...[byId]));
  }, []);

  useEffect(() => {
    if (!userId || windows.length === 0) return;

    const unsubs: (() => void)[] = [];

    for (const window of windows) {
      const label = window.label;
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(window.start)),
        where('date', '<=', Timestamp.fromDate(window.end)),
        orderBy('date', 'desc')
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, Transaction>();
          snapshot.docs.forEach((doc) => {
            map.set(doc.id, { id: doc.id, ...doc.data() } as Transaction);
          });
          txWindowMapsRef.current.set(label, map);
          mergeTxFromRefs();
          setLoading(false);
          setChartLoadingOlder(false);
        },
        (err) => {
          console.error('Dashboard transactions listener error:', err);
          setLoading(false);
          setChartLoadingOlder(false);
        }
      );
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [userId, windows, mergeTxFromRefs]);

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
      const ids = tripSnap.docs.map(
        (d) => (d.id)
      );
      setTripIds(ids);
      if (ids.length === 0) {
        expChunkMapsRef.current.clear();
        setTripExpenses([]);
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || tripIds.length === 0 || windows.length === 0) {
      if (tripIds.length === 0 && userId) {
        setTripExpenses([]);
      }
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < tripIds.length; i += TRIP_ID_CHUNK) {
      chunks.push(tripIds.slice(i, i + TRIP_ID_CHUNK));
    }

    const unsubs: (() => void)[] = [];

    for (const chunk of chunks) {
      const chunkKey = chunk.join(',');
      const qExp = query(
        collection(db, 'trip_expenses'),
        where('tripId', 'in', chunk)
      );

      const unsub = onSnapshot(qExp, (expSnap) => {
        const map = new Map<string, TripExpense>();
        expSnap.docs.forEach((doc) => {
          map.set(doc.id, { id: doc.id, ...doc.data() } as TripExpense);
        });
        expChunkMapsRef.current.set(chunkKey, map);
        mergeExpFromRefs(windows);
        setLoading(false);
        setChartLoadingOlder(false);
      });
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [userId, tripIds, windows, mergeExpFromRefs]);

  const chartLoadingOlderRef = useRef(false);

  const loadOlderChartData = useCallback(() => {
    if (chartLoadingOlderRef.current || !hasOlderChartData) return;
    chartLoadingOlderRef.current = true;
    setChartLoadingOlder(true);
    setWindows((prev) => {
      if (prev.length === 0) return prev;
      const oldestStart = prev.reduce(
        (min, w) => (w.start < min ? w.start : min),
        prev[0].start
      );
      return [...prev, buildOlder6MonthWindow(oldestStart)];
    });
  }, [hasOlderChartData]);

  useEffect(() => {
    if (!chartLoadingOlder) {
      chartLoadingOlderRef.current = false;
    }
  }, [chartLoadingOlder]);

  const oldestLoaded = useMemo(() => {
    if (windows.length === 0) return null;
    return windows.reduce(
      (min, w) => (w.start < min ? w.start : min),
      windows[0].start
    );
  }, [windows]);

  return {
    transactions,
    tripExpenses,
    loading,
    loadOlderChartData,
    hasOlderChartData,
    chartLoadingOlder,
    oldestLoaded,
  };
}
