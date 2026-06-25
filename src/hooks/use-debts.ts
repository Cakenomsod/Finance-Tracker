import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Debt } from '@/lib/firestore-types';
import { Timestamp } from 'firebase/firestore';
import { createDebt, updateDebt, deleteDebt, createTripSettlement } from '@/lib/firestore';
import { recordDebtSettlementCashFlow } from '@/lib/debt-payment';
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

    const createdAtMillis = (createdAt: Debt['createdAt'] | null | undefined) =>
      createdAt?.toMillis?.() ?? (createdAt?.seconds != null ? createdAt.seconds * 1000 : 0);

    const updateCombined = () => {
      // Merge, remove duplicates just in case (should not happen here), and sort by date descending
      const combined = [...fromDebts, ...toDebts];
      combined.sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt));
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

  const settleDebt = async (id: string, payAmount?: number) => {
    if (!user) throw new Error('Must be logged in to settle a debt');
    const debt = debts.find((d) => d.id === id);
    if (!debt) throw new Error('Debt not found');

    const amount = payAmount ?? debt.amount;
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    if (amount > debt.amount) throw new Error('Payment amount exceeds remaining debt');

    const isFullPayment = amount >= debt.amount - 0.001;

    if (isFullPayment) {
      await updateDebt(id, {
        status: 'settled',
        settledAt: Timestamp.now(),
        paidAmount: (debt.paidAmount || 0) + amount,
      });
    } else {
      const newRemaining = Math.round((debt.amount - amount) * 100) / 100;
      await updateDebt(id, {
        amount: newRemaining,
        paidAmount: (debt.paidAmount || 0) + amount,
        remainingAmount: newRemaining,
      });
    }

    await createTripSettlement({
      userId: user.uid,
      fromUserId: debt.fromUserId,
      fromDisplayName: debt.fromDisplayName || debt.fromUserId,
      toUserId: debt.toUserId,
      toDisplayName: debt.toDisplayName || debt.toUserId,
      amount,
      isPartial: !isFullPayment,
      date: Timestamp.now(),
      note: debt.id ? `debt:${debt.id}` : undefined,
    });

    await recordDebtSettlementCashFlow(user.uid, debt, amount, {
      note: debt.id ? `debt:${debt.id}` : undefined,
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
