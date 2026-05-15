import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Debt } from '@/lib/firestore-types';
import { createDebt, updateDebt, deleteDebt } from '@/lib/firestore';
import { useAuth } from './use-auth';

export function useDebts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setDebts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Because Firestore requires composite indexes for OR queries,
    // we set up two separate listeners and merge them.
    const qFrom = query(
      collection(db, 'debts'),
      where('fromUserId', '==', user.uid)
    );

    const qTo = query(
      collection(db, 'debts'),
      where('toUserId', '==', user.uid)
    );

    let fromDebts: Debt[] = [];
    let toDebts: Debt[] = [];
    let isFromLoaded = false;
    let isToLoaded = false;

    const updateCombined = () => {
      // Merge, remove duplicates just in case (should not happen here), and sort by date descending
      const combined = [...fromDebts, ...toDebts];
      // Sort by createdAt descending
      combined.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setDebts(combined);
      if (isFromLoaded && isToLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeFrom = onSnapshot(
      qFrom,
      (snapshot) => {
        fromDebts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Debt[];
        isFromLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error fetching debts (from):', err);
        setError(err);
      }
    );

    const unsubscribeTo = onSnapshot(
      qTo,
      (snapshot) => {
        toDebts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Debt[];
        isToLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error fetching debts (to):', err);
        setError(err);
      }
    );

    return () => {
      unsubscribeFrom();
      unsubscribeTo();
    };
  }, [user]);

  const addDebt = async (data: Omit<Debt, 'id' | 'createdAt' | 'status' | 'settledAt'>) => {
    if (!user) throw new Error('Must be logged in to add a debt');
    return createDebt(data);
  };

  const editDebt = async (id: string, data: Partial<Omit<Debt, 'id' | 'createdAt'>>) => {
    if (!user) throw new Error('Must be logged in to edit a debt');
    return updateDebt(id, data);
  };

  const removeDebt = async (id: string) => {
    if (!user) throw new Error('Must be logged in to delete a debt');
    return deleteDebt(id);
  };

  const settleDebt = async (id: string) => {
    if (!user) throw new Error('Must be logged in to settle a debt');
    return updateDebt(id, {
      status: 'settled',
      settledAt: new Date() as any, // Firebase timestamp handle will convert it if we use serverTimestamp or just pass Date for some conversions, but better to use Timestamp.now() or let update handle Date.
    });
  };

  return {
    debts,
    loading,
    error,
    addDebt,
    editDebt,
    removeDebt,
    settleDebt,
  };
}
