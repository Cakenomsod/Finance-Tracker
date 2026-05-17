import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TripExpense } from '@/lib/firestore-types';
import { createTripExpense, updateTripExpense, deleteTripExpense } from '@/lib/firestore';
import { useAuth } from './use-auth';

export interface MemberBalance {
  userId: string;
  displayName: string;
  totalPaid: number;    // how much they actually paid
  totalShare: number;   // how much they owe
  netBalance: number;   // positive = owed money back, negative = owes money
}

export function useTripExpenses(tripId: string) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) { setExpenses([]); setLoading(false); return; }

    const q = query(
      collection(db, 'trip_expenses'),
      where('tripId', '==', tripId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TripExpense));
      docs.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setExpenses(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching trip expenses:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [tripId]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.totalAmount, 0),
    [expenses]
  );

  /** Calculate net balance per member across all TripExpenses */
  const calcBalances = (memberIds: string[], displayNames: Record<string, string>): MemberBalance[] => {
    const paid: Record<string, number> = {};
    const share: Record<string, number> = {};

    memberIds.forEach(id => { paid[id] = 0; share[id] = 0; });

    expenses.forEach(expense => {
      expense.payers.forEach(p => {
        if (paid[p.userId] !== undefined) paid[p.userId] += p.amount;
      });
      expense.shares.forEach(s => {
        if (share[s.userId] !== undefined) share[s.userId] += s.amount;
      });
    });

    return memberIds.map(uid => ({
      userId: uid,
      displayName: displayNames[uid] || uid,
      totalPaid: Math.round(paid[uid] || 0),
      totalShare: Math.round(share[uid] || 0),
      netBalance: Math.round((paid[uid] || 0) - (share[uid] || 0)),
    }));
  };

  const addExpense = async (data: Omit<TripExpense, 'id' | 'createdAt'>) => {
    if (!user) throw new Error('Not logged in');
    return createTripExpense({ ...data, userId: user.uid });
  };

  const editExpense = async (id: string, data: Partial<Omit<TripExpense, 'id' | 'createdAt'>>) => {
    return updateTripExpense(id, data);
  };

  const removeExpense = async (id: string) => {
    return deleteTripExpense(id);
  };

  return { expenses, loading, totalExpenses, calcBalances, addExpense, editExpense, removeExpense };
}
