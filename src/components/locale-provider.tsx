'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useUserSettings } from '@/hooks/use-user-settings';
import { AppLocale, isAppLocale, LOCALE_STORAGE_KEY } from '@/lib/locale';
import { t as translate, type MessageKey } from '@/lib/i18n';

interface LocaleContextType {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  t: (key: MessageKey, vars?: Record<string, string>) => string;
  detecting: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: async () => {},
  t: (key) => key,
  detecting: false,
});

export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserSettings();
  const [locale, setLocaleState] = useState<AppLocale>('en');
  const [detecting, setDetecting] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const persistLocale = useCallback(
    async (next: AppLocale) => {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          locale: next,
          updatedAt: serverTimestamp(),
        });
      }
    },
    [user]
  );

  const setLocale = useCallback(
    async (next: AppLocale) => {
      setLocaleState(next);
      document.documentElement.lang = next;
      await persistLocale(next);
    },
    [persistLocale]
  );

  useEffect(() => {
    if (!user || profile?.locale || !initialized) return;
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isAppLocale(stored)) {
      void persistLocale(stored);
    }
  }, [user, profile?.locale, initialized, persistLocale]);

  useEffect(() => {
    if (profileLoading) return;

    const init = async () => {
      if (profile?.locale && isAppLocale(profile.locale)) {
        setLocaleState(profile.locale);
        document.documentElement.lang = profile.locale;
        localStorage.setItem(LOCALE_STORAGE_KEY, profile.locale);
        setDetecting(false);
        setInitialized(true);
        return;
      }

      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && isAppLocale(stored)) {
        setLocaleState(stored);
        document.documentElement.lang = stored;
        if (user && !profile?.locale) {
          await persistLocale(stored);
        }
        setDetecting(false);
        setInitialized(true);
        return;
      }

      try {
        const res = await fetch('/api/locale/detect');
        const data = await res.json();
        const detected: AppLocale = isAppLocale(data.locale) ? data.locale : 'en';
        setLocaleState(detected);
        document.documentElement.lang = detected;
        localStorage.setItem(LOCALE_STORAGE_KEY, detected);
        if (user) {
          const updates: Record<string, unknown> = {
            locale: detected,
            updatedAt: serverTimestamp(),
          };
          if (!profile?.currency && data.currency) {
            updates.currency = data.currency;
          }
          await updateDoc(doc(db, 'users', user.uid), updates);
        }
      } catch {
        setLocaleState('en');
        document.documentElement.lang = 'en';
      } finally {
        setDetecting(false);
        setInitialized(true);
      }
    };

    if (!initialized) {
      void init();
    }
  }, [profile, profileLoading, user, persistLocale, initialized]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string>) => translate(locale, key, vars),
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, detecting }}>
      {children}
    </LocaleContext.Provider>
  );
}
