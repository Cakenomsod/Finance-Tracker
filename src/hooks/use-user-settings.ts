'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { AiTextProvider, ImmichSettings, UserProfile } from '@/lib/firestore-types';

export function useUserSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  const saveImmichSettings = useCallback(
    async (settings: Omit<ImmichSettings, 'lastVerifiedAt'>) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        immich: {
          baseUrl: settings.baseUrl.replace(/\/$/, ''),
          apiKey: settings.apiKey,
          lastVerifiedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveAiSettings = useCallback(
    async (aiTextProvider: AiTextProvider, localAiBaseUrl?: string) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        aiTextProvider,
        ...(localAiBaseUrl !== undefined ? { localAiBaseUrl } : {}),
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveProfile = useCallback(
    async (data: { displayName?: string; photoURL?: string | null }) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveCurrency = useCallback(
    async (currency: string) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        currency,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveLocale = useCallback(
    async (locale: string) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        locale,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveAiInsightsSettings = useCallback(
    async (settings: { aiInsightsWeekly?: boolean; aiInsightsMonthly?: boolean }) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        ...settings,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const saveMoneyFeatures = useCallback(
    async (settings: { accountsEnabled?: boolean; moneyPoolsEnabled?: boolean }) => {
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        ...settings,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  return {
    profile,
    loading,
    currency: profile?.currency ?? 'THB',
    locale: profile?.locale,
    immich: profile?.immich,
    aiTextProvider: profile?.aiTextProvider ?? 'gemma',
    localAiBaseUrl: profile?.localAiBaseUrl,
    aiInsightsWeekly: profile?.aiInsightsWeekly === true,
    aiInsightsMonthly: profile?.aiInsightsMonthly === true,
    accountsEnabled: profile?.accountsEnabled === true,
    moneyPoolsEnabled: profile?.moneyPoolsEnabled === true,
    saveImmichSettings,
    saveAiSettings,
    saveAiInsightsSettings,
    saveMoneyFeatures,
    saveProfile,
    saveCurrency,
    saveLocale,
  };
}
