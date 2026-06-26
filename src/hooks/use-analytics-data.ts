'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { MonthSelection } from '@/lib/firestore-query/types';
import { buildMonthWindow } from '@/lib/firestore-query/date-windows';
import { mergeTransactions, type CombinedTransaction } from '@/lib/aggregate-transactions';
import { mergeSnapshots } from '@/lib/firestore-query/merge-snapshots';

const TRIP_ID_CHUNK = 30;

export function useAnalyticsData(
  userId: string | undefined,
  month: MonthSelection
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const expChunkMapsRef = useRef<Map<string, Map<string, TripExpense>>>(
    new Map()
  );

  const window = useMemo(() => buildMonthWindow(month.year, month.month), [month.year, month.month]);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setTripExpenses([]);
      setTripIds([]);
      setLoading(false);
      expChunkMapsRef.current.clear();
      return;
    }
    setLoading(true);
    expChunkMapsRef.current.clear();
  }, [userId, month.year, month.month]);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(window.start)),
      where('date', '<=', Timestamp.fromDate(window.end)),
      orderBy('date', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Transaction
        );
        setTransactions(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Analytics transactions listener error:', err);
        setError(err);
        setLoading(false);
      }
    );
  }, [userId, window.start.getTime(), window.end.getTime()]);

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
    if (!userId || tripIds.length === 0) {
      if (tripIds.length === 0) setTripExpenses([]);
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
        where('tripId', 'in', chunk),
        where('date', '>=', Timestamp.fromDate(window.start)),
        where('date', '<=', Timestamp.fromDate(window.end)),
        orderBy('date', 'desc')
      );

      const unsub = onSnapshot(
        qExp,
        (expSnap) => {
          const map = new Map<string, TripExpense>();
          expSnap.docs.forEach((doc) => {
            map.set(doc.id, { id: doc.id, ...doc.data() } as TripExpense);
          });
          expChunkMapsRef.current.set(chunkKey, map);
          setTripExpenses(mergeSnapshots(...[...expChunkMapsRef.current.values()]));
          setLoading(false);
        },
        (err) => {
          console.error('Analytics trip expenses listener error:', err);
          setError(err);
          setLoading(false);
        }
      );
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [userId, tripIds, window.start.getTime(), window.end.getTime()]);

  const combined = useMemo<CombinedTransaction[]>(
    () => mergeTransactions(transactions, tripExpenses, userId),
    [transactions, tripExpenses, userId]
  );

  return { combined, loading, error };
}
