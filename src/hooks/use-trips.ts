import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trip } from '@/lib/firestore-types';
import { createTrip, updateTrip, deleteTrip, closeTrip, reopenTrip } from '@/lib/firestore';
import { useAuth } from './use-auth';

export function useTrips() {
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

    // Query trips where the user is the creator OR a member (UID-based)
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

  const addTrip = async (data: Omit<Trip, 'id' | 'createdAt' | 'createdBy' | 'status'>) => {
    if (!user) throw new Error('Must be logged in to create a trip');
    return createTrip({ ...data, createdBy: user.uid, status: 'active' });
  };

  const editTrip = async (id: string, data: Partial<Omit<Trip, 'id' | 'createdAt'>>) => {
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

  // Helper: get only active trips (useful for dropdowns)
  const activeTrips = trips.filter((t) => t.status === 'active');
  const closedTrips = trips.filter((t) => t.status === 'closed');

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
}
