import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TripSettlement } from '@/lib/firestore-types';
import { createTripSettlement, deleteTripSettlement } from '@/lib/firestore';
import { createDebtSettlementTransaction } from '@/lib/debt-payment';
import { useAuth } from './use-auth';

export function useTripSettlements(tripId?: string) {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<TripSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setSettlements([]); setLoading(false); return; }

    const q = tripId
      ? query(collection(db, 'trip_settlements'), where('tripId', '==', tripId))
      : query(
          collection(db, 'trip_settlements'),
          or(
            where('fromUserId', '==', user.uid),
            where('toUserId', '==', user.uid),
            where('userId', '==', user.uid)
          )
        );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSettlement));
      docs.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setSettlements(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching trip settlements:", err);
      setLoading(false);
    });

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
    const settlementRef = await createTripSettlement({ ...data, userId: user.uid });

    const isPayer = data.fromUserId === user.uid;
    const isReceiver = data.toUserId === user.uid;
    if (isPayer || isReceiver) {
      const counterpartyName = isPayer
        ? data.toDisplayName || data.toUserId
        : data.fromDisplayName || data.fromUserId;

      await createDebtSettlementTransaction(user.uid, {
        amount: data.amount,
        isPayer,
        counterpartyName,
        note: data.tripId ? `trip:${data.tripId}` : undefined,
        date: data.date,
      });
    }

    return settlementRef;
  };

  const removeSettlement = async (id: string) => {
    return deleteTripSettlement(id);
  };

  return { settlements, loading, getSettledAmounts, recordSettlement, removeSettlement };
}
