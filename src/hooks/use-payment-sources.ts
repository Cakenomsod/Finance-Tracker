'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { PaymentSource } from '@/lib/firestore-types';
import {
  createPaymentSource,
  updatePaymentSource,
  deletePaymentSource,
  clearDefaultPaymentSources,
} from '@/lib/firestore';

function sortSources(items: PaymentSource[]): PaymentSource[] {
  return [...items].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    if (a.type === 'cash' && b.type !== 'cash') return 1;
    if (a.type !== 'cash' && b.type === 'cash') return -1;
    return a.name.localeCompare(b.name, 'th');
  });
}

export function usePaymentSources() {
  const { user } = useAuth();
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSources([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'payment_sources'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentSource));
        setSources(sortSources(items));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  const activeSources = useMemo(
    () => sources.filter((s) => !s.archived),
    [sources]
  );

  const bankAccounts = useMemo(
    () => activeSources.filter((s) => s.type === 'bank_account'),
    [activeSources]
  );

  const debitCards = useMemo(
    () => activeSources.filter((s) => s.type === 'debit_card'),
    [activeSources]
  );

  const cashSource = useMemo(
    () => activeSources.find((s) => s.type === 'cash'),
    [activeSources]
  );

  const defaultSource = useMemo(
    () => activeSources.find((s) => s.isDefault) ?? activeSources[0],
    [activeSources]
  );

  const nextSortOrder = useMemo(() => {
    let max = -1;
    for (const s of sources) {
      if (typeof s.sortOrder === 'number' && s.sortOrder > max) max = s.sortOrder;
    }
    return max + 1;
  }, [sources]);

  const addSource = useCallback(
    async (data: Omit<PaymentSource, 'id' | 'createdAt' | 'userId'>) => {
      if (!user) throw new Error('Not logged in');
      if (data.isDefault) {
        await clearDefaultPaymentSources(user.uid);
      }
      return createPaymentSource({
        ...data,
        sortOrder: data.sortOrder ?? nextSortOrder,
        userId: user.uid,
      });
    },
    [user, nextSortOrder]
  );

  const editSource = useCallback(
    async (id: string, data: Partial<Omit<PaymentSource, 'id' | 'createdAt' | 'userId'>>) => {
      if (!user) throw new Error('Not logged in');
      if (data.isDefault) {
        await clearDefaultPaymentSources(user.uid, id);
      }
      return updatePaymentSource(id, data);
    },
    [user]
  );

  const removeSource = useCallback(async (id: string) => {
    return deletePaymentSource(id);
  }, []);

  const archiveSource = useCallback(async (id: string) => {
    return updatePaymentSource(id, { archived: true, isDefault: false });
  }, []);

  const setDefaultSource = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not logged in');
      await clearDefaultPaymentSources(user.uid, id);
      return updatePaymentSource(id, { isDefault: true });
    },
    [user]
  );

  /** Persist display order for active sources (ids in desired order). */
  const reorderSources = useCallback(async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, index) => updatePaymentSource(id, { sortOrder: index }))
    );
  }, []);

  return {
    sources,
    activeSources,
    bankAccounts,
    debitCards,
    cashSource,
    defaultSource,
    loading,
    addSource,
    editSource,
    removeSource,
    archiveSource,
    setDefaultSource,
    reorderSources,
  };
}
