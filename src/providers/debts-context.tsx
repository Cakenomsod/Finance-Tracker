'use client';

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import {
  createDebt,
  createTripSettlement,
  deleteDebt,
  updateDebt,
} from '@/lib/firestore';
import type { Debt } from '@/lib/firestore-types';
import { db } from '@/lib/firebase';
import { recordDebtSettlementCashFlow } from '@/lib/debt-payment';

export interface DebtsContextValue {
  debts: Debt[];
  loading: boolean;
  error: Error | null;
  addDebt: (
    data: Omit<Debt, 'id' | 'createdAt' | 'status' | 'settledAt'>
  ) => Promise<Awaited<ReturnType<typeof createDebt>>>;
  editDebt: (
    id: string,
    data: Partial<Omit<Debt, 'id' | 'createdAt'>>
  ) => Promise<Awaited<ReturnType<typeof updateDebt>>>;
  removeDebt: (
    id: string
  ) => Promise<Awaited<ReturnType<typeof deleteDebt>>>;
  settleDebt: (id: string, payAmount?: number) => Promise<void>;
}

export const DebtsContext = createContext<DebtsContextValue | null>(null);

export function DebtsProvider({ children }: { children: ReactNode }) {
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

    const createdAtMillis = (
      createdAt: Debt['createdAt'] | null | undefined
    ) =>
      createdAt?.toMillis?.() ??
      (createdAt?.seconds != null ? createdAt.seconds * 1000 : 0);

    const updateCombined = () => {
      const combined = [...fromDebts, ...toDebts];
      combined.sort(
        (a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt)
      );
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

  const value = useMemo<DebtsContextValue>(() => {
    const addDebt = async (
      data: Omit<Debt, 'id' | 'createdAt' | 'status' | 'settledAt'>
    ) => {
      if (!user) throw new Error('Must be logged in to add a debt');
      return createDebt(data);
    };

    const editDebt = async (
      id: string,
      data: Partial<Omit<Debt, 'id' | 'createdAt'>>
    ) => {
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
      if (amount > debt.amount) {
        throw new Error('Payment amount exceeds remaining debt');
      }

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
  }, [debts, loading, error, user]);

  return (
    <DebtsContext.Provider value={value}>{children}</DebtsContext.Provider>
  );
}
