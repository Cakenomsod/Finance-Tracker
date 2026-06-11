import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/lib/firestore-types';
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/firestore';
import { collectImmichAssetIds } from '@/lib/immich/asset-ids';
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser';
import { deleteTransactionDebts, syncTransactionDebts } from '@/lib/transaction-debt';
import { useAuth } from './use-auth';

export function useTransactions() {
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

  const addTransaction = async (data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => {
    if (!user) throw new Error('Must be logged in to add a transaction');
    const txData = { ...data, userId: user.uid, currency: 'THB' as const };
    const txRef = await createTransaction(txData);
    await syncTransactionDebts(user.uid, txRef.id, txData);
    return txRef;
  };

  const editTransaction = async (id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>) => {
    if (!user) throw new Error('Must be logged in to edit a transaction');
    const existing = transactions.find((t) => t.id === id);
    if (!existing) throw new Error('Transaction not found');
    const merged = { ...existing, ...data, currency: 'THB' as const };
    await updateTransaction(id, { ...data, currency: 'THB' });
    await syncTransactionDebts(user.uid, id, merged);
  };

  const removeTransaction = async (
    id: string,
    override?: { immichAssetId?: string | null; immichAssetIds?: string[] | null } | null
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
}
