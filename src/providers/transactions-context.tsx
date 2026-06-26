'use client';

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '@/lib/firestore';
import type { Transaction } from '@/lib/firestore-types';
import { db } from '@/lib/firebase';
import { collectImmichAssetIds } from '@/lib/immich/asset-ids';
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser';
import {
  deleteTransactionDebts,
  syncTransactionDebts,
} from '@/lib/transaction-debt';

export interface TransactionsContextValue {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  addTransaction: (
    data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>
  ) => Promise<Awaited<ReturnType<typeof createTransaction>>>;
  editTransaction: (
    id: string,
    data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>
  ) => Promise<void>;
  removeTransaction: (
    id: string,
    override?: {
      immichAssetId?: string | null;
      immichAssetIds?: string[] | null;
    } | null
  ) => Promise<Awaited<ReturnType<typeof deleteTransaction>>>;
}

export const TransactionsContext =
  createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching transactions:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const value = useMemo<TransactionsContextValue>(() => {
    const addTransaction = async (
      data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>
    ) => {
      if (!user) throw new Error('Must be logged in to add a transaction');
      const txData = { ...data, userId: user.uid, currency: 'THB' as const };
      const txRef = await createTransaction(txData);
      await syncTransactionDebts(user.uid, txRef.id, txData);
      return txRef;
    };

    const editTransaction = async (
      id: string,
      data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>
    ) => {
      if (!user) throw new Error('Must be logged in to edit a transaction');
      const existing = transactions.find((t) => t.id === id);
      if (!existing) throw new Error('Transaction not found');
      const merged = { ...existing, ...data, currency: 'THB' as const };
      await updateTransaction(id, { ...data, currency: 'THB' });
      await syncTransactionDebts(user.uid, id, merged);
    };

    const removeTransaction = async (
      id: string,
      override?: {
        immichAssetId?: string | null;
        immichAssetIds?: string[] | null;
      } | null
    ) => {
      if (!user) throw new Error('Must be logged in to delete a transaction');
      const tx = transactions.find((t) => t.id === id);
      const ids = collectImmichAssetIds({
        immichAssetId: override?.immichAssetId ?? tx?.immichAssetId,
        immichAssetIds: override?.immichAssetIds ?? tx?.immichAssetIds,
      });
      if (ids.length > 0) {
        await requestDeleteImmichAssets(ids);
      }
      await deleteTransactionDebts(id);
      return deleteTransaction(id);
    };

    return {
      transactions,
      loading,
      error,
      addTransaction,
      editTransaction,
      removeTransaction,
    };
  }, [transactions, loading, error, user]);

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
}
