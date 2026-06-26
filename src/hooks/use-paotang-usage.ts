'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import type { Transaction } from '@/lib/firestore-types';
import {
  getPaotangUsageFromTransactions,
  type PaotangQuotaUsage,
} from '@/lib/transaction-payment';

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function usePaotangUsage(options: {
  forDate: Date;
  quotaOwner: string;
  excludeTxId?: string;
}): PaotangQuotaUsage {
  const { user } = useAuth();
  const { forDate, quotaOwner, excludeTxId } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const monthStart = startOfMonth(forDate).getTime();
  const monthEnd = endOfMonth(forDate).getTime();

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const start = new Date(monthStart);
    const end = new Date(monthEnd);

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('paymentMethod', '==', 'paotang'),
      where('date', '>=', Timestamp.fromDate(start)),
      where('date', '<=', Timestamp.fromDate(end)),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setTransactions(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Transaction
        )
      );
    });
  }, [user, monthStart, monthEnd]);

  return useMemo(
    () =>
      getPaotangUsageFromTransactions(transactions, {
        excludeTxId,
        forDate,
        quotaOwner,
      }),
    [transactions, excludeTxId, forDate, quotaOwner]
  );
}
