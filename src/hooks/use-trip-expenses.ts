import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trip, TripExpense } from '@/lib/firestore-types';
import { convertToHomeCurrency } from '@/lib/trip-currency';
import { createTripExpense, updateTripExpense, deleteTripExpense } from '@/lib/firestore';
import { useAuth } from './use-auth';

export interface MemberBalance {
  userId: string;
  displayName: string;
  totalPaid: number;    // how much they actually paid
  totalShare: number;   // how much they owe
  netBalance: number;   // positive = owed money back, negative = owes money
}

export function useTripExpenses(tripId: string, trip?: Trip | null) {
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
      docs.sort((a, b) => {
        const aTime = a.date?.toMillis?.() ?? (a.date?.seconds ?? 0) * 1000;
        const bTime = b.date?.toMillis?.() ?? (b.date?.seconds ?? 0) * 1000;
        return bTime - aTime;
      });
      setExpenses(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching trip expenses:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [tripId]);

  const totalExpenses = useMemo(
    () => expenses.reduce(
      (sum, e) => sum + convertToHomeCurrency(e.totalAmount, e.currency, trip),
      0
    ),
    [expenses, trip]
  );

  /** Calculate net balance per member across all TripExpenses */
  const calcBalances = (
    memberIds: string[],
    displayNames: Record<string, string>,
    currentUserId?: string | null
  ): MemberBalance[] => {
    const paid: Record<string, number> = {};
    const share: Record<string, number> = {};

    memberIds.forEach(id => { paid[id] = 0; share[id] = 0; });

    const resolve = (key: string) => {
      if (memberIds.includes(key)) return key;
      const uid = currentUserId || user?.uid || '';
      if (uid && (key === uid || key.toLowerCase() === 'me')) {
        return memberIds.find(m => m === uid || m.toLowerCase() === 'me') || null;
      }
      return null;
    };

    expenses.forEach(expense => {
      (expense.payers || []).forEach(p => {
        const key = resolve(p.userId);
        if (key && paid[key] !== undefined) {
          paid[key] += convertToHomeCurrency(p.amount, expense.currency, trip);
        }
      });
      (expense.shares || []).forEach(s => {
        const key = resolve(s.userId);
        if (key && share[key] !== undefined) {
          share[key] += convertToHomeCurrency(s.amount, expense.currency, trip);
        }
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
