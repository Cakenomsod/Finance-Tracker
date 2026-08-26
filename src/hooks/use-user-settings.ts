'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { AiTextProvider, ImmichSettings, UserProfile } from '@/lib/firestore-types';

type FeatureFlagKey =
  | 'aiInsightsWeekly'
  | 'aiInsightsMonthly'
  | 'accountsEnabled'
  | 'moneyPoolsEnabled';

function featureStorageKey(uid: string, key: FeatureFlagKey) {
  return `ft-feature:${uid}:${key}`;
}

function readLocalFeature(uid: string, key: FeatureFlagKey): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(featureStorageKey(uid, key));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // ignore
  }
  return null;
}

function writeLocalFeature(uid: string, key: FeatureFlagKey, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(featureStorageKey(uid, key), value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

function resolveFlag(
  uid: string | undefined,
  remote: boolean | undefined,
  optimistic: Partial<Record<FeatureFlagKey, boolean>>,
  key: FeatureFlagKey
): boolean {
  if (optimistic[key] !== undefined) return optimistic[key]!;
  if (typeof remote === 'boolean') return remote;
  if (uid) {
    const local = readLocalFeature(uid, key);
    if (local !== null) return local;
  }
  return false;
}

export function useUserSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimisticFlags, setOptimisticFlags] = useState<Partial<Record<FeatureFlagKey, boolean>>>(
    {}
  );
  const pendingSaveRef = useRef(0);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setOptimisticFlags({});
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = { uid: snap.id, ...snap.data() } as UserProfile;
          setProfile(data);

          // Re-persist local feature flags if Firestore is missing them (prevents
          // toggles appearing to "turn off" after a partial profile write).
          const restore: Record<string, boolean> = {};
          const keys: FeatureFlagKey[] = [
            'aiInsightsWeekly',
            'aiInsightsMonthly',
            'accountsEnabled',
            'moneyPoolsEnabled',
          ];
          for (const key of keys) {
            if (typeof data[key] === 'boolean') {
              writeLocalFeature(user.uid, key, data[key] as boolean);
            } else {
              const local = readLocalFeature(user.uid, key);
              if (local === true) restore[key] = true;
            }
          }
          if (Object.keys(restore).length > 0 && pendingSaveRef.current === 0) {
            pendingSaveRef.current += 1;
            void updateDoc(doc(db, 'users', user.uid), {
              ...restore,
              updatedAt: serverTimestamp(),
            }).finally(() => {
              pendingSaveRef.current = Math.max(0, pendingSaveRef.current - 1);
            });
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
        // Clear optimistic overrides once remote snapshot catches up (and no in-flight saves)
        if (pendingSaveRef.current === 0) {
          setOptimisticFlags({});
        }
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
      pendingSaveRef.current += 1;
      const patch: Partial<Record<FeatureFlagKey, boolean>> = {};
      if (typeof settings.aiInsightsWeekly === 'boolean') {
        patch.aiInsightsWeekly = settings.aiInsightsWeekly;
        writeLocalFeature(user.uid, 'aiInsightsWeekly', settings.aiInsightsWeekly);
      }
      if (typeof settings.aiInsightsMonthly === 'boolean') {
        patch.aiInsightsMonthly = settings.aiInsightsMonthly;
        writeLocalFeature(user.uid, 'aiInsightsMonthly', settings.aiInsightsMonthly);
      }
      setOptimisticFlags((prev) => ({ ...prev, ...patch }));
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          ...settings,
          updatedAt: serverTimestamp(),
        });
      } finally {
        pendingSaveRef.current = Math.max(0, pendingSaveRef.current - 1);
      }
    },
    [user]
  );

  const saveMoneyFeatures = useCallback(
    async (settings: { accountsEnabled?: boolean; moneyPoolsEnabled?: boolean }) => {
      if (!user) throw new Error('Not logged in');
      pendingSaveRef.current += 1;
      const patch: Partial<Record<FeatureFlagKey, boolean>> = {};
      if (typeof settings.accountsEnabled === 'boolean') {
        patch.accountsEnabled = settings.accountsEnabled;
        writeLocalFeature(user.uid, 'accountsEnabled', settings.accountsEnabled);
      }
      if (typeof settings.moneyPoolsEnabled === 'boolean') {
        patch.moneyPoolsEnabled = settings.moneyPoolsEnabled;
        writeLocalFeature(user.uid, 'moneyPoolsEnabled', settings.moneyPoolsEnabled);
      }
      setOptimisticFlags((prev) => ({ ...prev, ...patch }));
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          ...settings,
          updatedAt: serverTimestamp(),
        });
      } finally {
        pendingSaveRef.current = Math.max(0, pendingSaveRef.current - 1);
      }
    },
    [user]
  );

  const uid = user?.uid;

  return {
    profile,
    loading,
    currency: profile?.currency ?? 'THB',
    locale: profile?.locale,
    immich: profile?.immich,
    aiTextProvider: profile?.aiTextProvider ?? 'gemma',
    localAiBaseUrl: profile?.localAiBaseUrl,
    aiInsightsWeekly: resolveFlag(uid, profile?.aiInsightsWeekly, optimisticFlags, 'aiInsightsWeekly'),
    aiInsightsMonthly: resolveFlag(
      uid,
      profile?.aiInsightsMonthly,
      optimisticFlags,
      'aiInsightsMonthly'
    ),
    accountsEnabled: resolveFlag(uid, profile?.accountsEnabled, optimisticFlags, 'accountsEnabled'),
    moneyPoolsEnabled: resolveFlag(
      uid,
      profile?.moneyPoolsEnabled,
      optimisticFlags,
      'moneyPoolsEnabled'
    ),
    saveImmichSettings,
    saveAiSettings,
    saveAiInsightsSettings,
    saveMoneyFeatures,
    saveProfile,
    saveCurrency,
    saveLocale,
  };
}
