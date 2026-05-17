import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TripSettlement } from '@/lib/firestore-types';
import { createTripSettlement, deleteTripSettlement } from '@/lib/firestore';
import { useAuth } from './use-auth';

export function useTripSettlements(tripId?: string) {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<TripSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setSettlements([]); setLoading(false); return; }

    const constraints = tripId
      ? [where('userId', '==', user.uid), where('tripId', '==', tripId)]
      : [where('userId', '==', user.uid)];

    const q = query(
      collection(db, 'trip_settlements'),
      ...constraints,
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSettlement)));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [user, tripId]);

  /** Reduce balances by subtracting settled amounts.
   *  Returns { [fromUserId]: { [toUserId]: netOwed } } */
  const getSettledAmounts = (): Record<string, Record<string, number>> => {
    const map: Record<string, Record<string, number>> = {};
    settlements.forEach(s => {
      if (!map[s.fromUserId]) map[s.fromUserId] = {};
      map[s.fromUserId][s.toUserId] = (map[s.fromUserId][s.toUserId] || 0) + s.amount;
    });
    return map;
  };

  const recordSettlement = async (data: Omit<TripSettlement, 'id' | 'createdAt' | 'userId'>) => {
    if (!user) throw new Error('Not logged in');
    return createTripSettlement({ ...data, userId: user.uid });
  };

  const removeSettlement = async (id: string) => {
    return deleteTripSettlement(id);
  };

  return { settlements, loading, getSettledAmounts, recordSettlement, removeSettlement };
}
