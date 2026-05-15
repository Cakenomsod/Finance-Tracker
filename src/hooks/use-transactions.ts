import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/lib/firestore-types';
import { createTransaction, updateTransaction, deleteTransaction, createDebt } from '@/lib/firestore';
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
    const txRef = await createTransaction({ ...data, userId: user.uid });
    
    if ((data.paidBy === 'Me' || !data.paidBy) && data.splitWith) {
      await createDebt({
        fromUserId: data.splitWith,
        toUserId: user.uid,
        amount: Math.abs(data.amount),
        relatedTxIds: [txRef.id],
      });
    } else if (data.paidBy && data.paidBy !== 'Me') {
      await createDebt({
        fromUserId: user.uid,
        toUserId: data.paidBy,
        amount: Math.abs(data.amount),
        relatedTxIds: [txRef.id],
      });
    }
    
    return txRef;
  };

  const editTransaction = async (id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>) => {
    if (!user) throw new Error('Must be logged in to edit a transaction');
    return updateTransaction(id, data);
  };

  const removeTransaction = async (id: string) => {
    if (!user) throw new Error('Must be logged in to delete a transaction');
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
