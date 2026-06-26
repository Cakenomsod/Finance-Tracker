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
  or,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import {
  closeTrip,
  createTrip,
  deleteTrip,
  reopenTrip,
  updateTrip,
} from '@/lib/firestore';
import type { Trip } from '@/lib/firestore-types';
import { db } from '@/lib/firebase';

export interface TripsContextValue {
  trips: Trip[];
  activeTrips: Trip[];
  closedTrips: Trip[];
  loading: boolean;
  error: Error | null;
  addTrip: (
    data: Omit<Trip, 'id' | 'createdAt' | 'createdBy' | 'status'>
  ) => Promise<Awaited<ReturnType<typeof createTrip>>>;
  editTrip: (
    id: string,
    data: Partial<Omit<Trip, 'id' | 'createdAt'>>
  ) => Promise<Awaited<ReturnType<typeof updateTrip>>>;
  removeTrip: (
    id: string
  ) => Promise<Awaited<ReturnType<typeof deleteTrip>>>;
  endTrip: (id: string) => Promise<Awaited<ReturnType<typeof closeTrip>>>;
  resumeTrip: (id: string) => Promise<Awaited<ReturnType<typeof reopenTrip>>>;
}

export const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qTrips = query(
      collection(db, 'trips'),
      or(
        where('createdBy', '==', user.uid),
        where('members', 'array-contains', user.uid)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      qTrips,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Trip[];
        setTrips(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching trips:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const activeTrips = useMemo(
    () => trips.filter((t) => t.status === 'active'),
    [trips]
  );
  const closedTrips = useMemo(
    () => trips.filter((t) => t.status === 'closed'),
    [trips]
  );

  const value = useMemo<TripsContextValue>(() => {
    const addTrip = async (
      data: Omit<Trip, 'id' | 'createdAt' | 'createdBy' | 'status'>
    ) => {
      if (!user) throw new Error('Must be logged in to create a trip');
      return createTrip({ ...data, createdBy: user.uid, status: 'active' });
    };

    const editTrip = async (
      id: string,
      data: Partial<Omit<Trip, 'id' | 'createdAt'>>
    ) => {
      if (!user) throw new Error('Must be logged in to edit a trip');
      return updateTrip(id, data);
    };

    const removeTrip = async (id: string) => {
      if (!user) throw new Error('Must be logged in to delete a trip');
      return deleteTrip(id);
    };

    const endTrip = async (id: string) => {
      if (!user) throw new Error('Must be logged in to close a trip');
      return closeTrip(id);
    };

    const resumeTrip = async (id: string) => {
      if (!user) throw new Error('Must be logged in to reopen a trip');
      return reopenTrip(id);
    };

    return {
      trips,
      activeTrips,
      closedTrips,
      loading,
      error,
      addTrip,
      editTrip,
      removeTrip,
      endTrip,
      resumeTrip,
    };
  }, [trips, activeTrips, closedTrips, loading, error, user]);

  return (
    <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
  );
}
