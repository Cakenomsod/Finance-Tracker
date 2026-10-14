'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { pickClient } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { MoneyPool } from '@/lib/firestore-types';
import { createMoneyPool, updateMoneyPool, deleteMoneyPool } from '@/lib/firestore';

function notLoggedInMessage(): string {
  return pickClient({ th: 'ยังไม่ได้เข้าสู่ระบบ', en: 'Not logged in', zh: '尚未登录' });
}

export function useMoneyPools() {
  const { user } = useAuth();
  const [pools, setPools] = useState<MoneyPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPools([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'money_pools'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MoneyPool));
        items.sort((a, b) => a.name.localeCompare(b.name, 'th'));
        setPools(items);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  const activePools = useMemo(() => pools.filter((p) => !p.archived), [pools]);

  const addPool = useCallback(
    async (data: Omit<MoneyPool, 'id' | 'createdAt' | 'userId'>) => {
      if (!user) throw new Error(notLoggedInMessage());
      return createMoneyPool({ ...data, userId: user.uid });
    },
    [user]
  );

  const editPool = useCallback(
    async (
      id: string,
      data: Partial<Omit<MoneyPool, 'id' | 'createdAt' | 'userId' | 'targetAmount' | 'accountAllocations'>> & {
        targetAmount?: number | null;
        accountAllocations?: MoneyPool['accountAllocations'] | null;
      }
    ) => {
      return updateMoneyPool(id, data);
    },
    []
  );

  const removePool = useCallback(async (id: string) => {
    return deleteMoneyPool(id);
  }, []);

  const archivePool = useCallback(async (id: string) => {
    return updateMoneyPool(id, { archived: true });
  }, []);

  return {
    pools,
    activePools,
    loading,
    addPool,
    editPool,
    removePool,
    archivePool,
  };
}
