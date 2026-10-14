'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { pickClient } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { RecurringExpense } from '@/lib/firestore-types';
import {
  createRecurringExpense,
  createTransaction,
  updateRecurringExpense,
  deleteRecurringExpense,
} from '@/lib/firestore';
import {
  advanceRecurringDate,
  getRecurringDueDate,
  normalizeFrequencyInterval,
} from '@/lib/recurring-expenses';

function notLoggedInMessage(): string {
  return pickClient({ th: 'ยังไม่ได้เข้าสู่ระบบ', en: 'Not logged in', zh: '尚未登录' });
}

export function useRecurringExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'recurring_expenses'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringExpense));
        items.sort((a, b) => (a.nextDate?.seconds ?? 0) - (b.nextDate?.seconds ?? 0));
        setExpenses(items);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  const addExpense = useCallback(
    async (data: Omit<RecurringExpense, 'id' | 'createdAt' | 'userId'>) => {
      if (!user) throw new Error(notLoggedInMessage());
      return createRecurringExpense({ ...data, userId: user.uid });
    },
    [user]
  );

  const editExpense = useCallback(
    async (id: string, data: Partial<Omit<RecurringExpense, 'id' | 'createdAt' | 'userId'>>) => {
      return updateRecurringExpense(id, data);
    },
    []
  );

  const removeExpense = useCallback(async (id: string) => {
    return deleteRecurringExpense(id);
  }, []);

  const advanceExpenseCycle = useCallback(async (expense: RecurringExpense) => {
    if (!expense.id) throw new Error('Missing recurring expense id');
    const dueDate = getRecurringDueDate(expense) ?? new Date();
    const nextDate = advanceRecurringDate(
      dueDate,
      normalizeFrequencyInterval(expense.frequencyInterval),
      expense.frequency
    );
    await updateRecurringExpense(expense.id, {
      nextDate: Timestamp.fromDate(nextDate),
    });
  }, []);

  const confirmPayment = useCallback(
    async (expense: RecurringExpense, paidBy: string, currency = 'THB') => {
      if (!user) throw new Error(notLoggedInMessage());
      if (!expense.id) throw new Error('Missing recurring expense id');

      await createTransaction({
        userId: user.uid,
        amount: -Math.abs(expense.amount),
        type: 'expense',
        category: expense.category || 'Other',
        description: expense.name,
        date: Timestamp.fromDate(new Date()),
        paidBy,
        splitWith: null,
        tripId: null,
        receiptUrl: null,
        source: 'manual',
        currency,
        accountId: expense.accountId,
      });

      await advanceExpenseCycle(expense);
    },
    [user, advanceExpenseCycle]
  );

  const skipCycle = useCallback(
    async (expense: RecurringExpense) => {
      await advanceExpenseCycle(expense);
    },
    [advanceExpenseCycle]
  );

  return {
    expenses,
    loading,
    addExpense,
    editExpense,
    removeExpense,
    confirmPayment,
    skipCycle,
  };
}
