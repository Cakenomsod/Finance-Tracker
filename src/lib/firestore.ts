import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
  or,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Transaction, Debt, Trip, Category,
  TripExpense, TripSettlement, FriendRequest, CustomFriend,
} from './firestore-types';

// Collection References
export const usersRef = collection(db, 'users');
export const transactionsRef = collection(db, 'transactions');
export const debtsRef = collection(db, 'debts');
export const tripsRef = collection(db, 'trips');
export const categoriesRef = collection(db, 'categories');
export const tripExpensesRef = collection(db, 'trip_expenses');
export const tripSettlementsRef = collection(db, 'trip_settlements');
export const friendRequestsRef = collection(db, 'friend_requests');
export const customFriendsRef = collection(db, 'custom_friends');

// --- Transactions ---

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export const createTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
  return await addDoc(transactionsRef, stripUndefined({ ...data, createdAt: serverTimestamp() }));
};

export const getUserTransactions = async (userId: string) => {
  const q = query(transactionsRef, where('userId', '==', userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
};

export const updateTransaction = async (id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
  return await updateDoc(doc(db, 'transactions', id), stripUndefined(data));
};

export const deleteTransaction = async (id: string) => {
  return await deleteDoc(doc(db, 'transactions', id));
};

// --- Debts ---

export const createDebt = async (data: Omit<Debt, 'id' | 'createdAt' | 'status' | 'settledAt'>) => {
  return await addDoc(debtsRef, {
    ...data,
    createdAt: serverTimestamp(),
    status: 'pending',
    settledAt: null,
  });
};

export const updateDebt = async (id: string, data: Partial<Omit<Debt, 'id' | 'createdAt'>>) => {
  return await updateDoc(doc(db, 'debts', id), data);
};

export const deleteDebt = async (id: string) => {
  return await deleteDoc(doc(db, 'debts', id));
};

// --- Trips ---

export const createTrip = async (data: Omit<Trip, 'id' | 'createdAt'>) => {
  return await addDoc(tripsRef, { ...data, createdAt: serverTimestamp(), status: 'active' });
};

export const getUserTrips = async (userId: string) => {
  const q = query(tripsRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
};

export const updateTrip = async (id: string, data: Partial<Omit<Trip, 'id' | 'createdAt'>>) => {
  return await updateDoc(doc(db, 'trips', id), data);
};

export const deleteTrip = async (id: string) => {
  return await deleteDoc(doc(db, 'trips', id));
};

export const closeTrip = async (id: string) => {
  return await updateDoc(doc(db, 'trips', id), { status: 'closed' });
};

export const reopenTrip = async (id: string) => {
  return await updateDoc(doc(db, 'trips', id), { status: 'active' });
};

// --- Trip Expenses ---

export const createTripExpense = async (data: Omit<TripExpense, 'id' | 'createdAt'>) => {
  const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
  return await addDoc(tripExpensesRef, { ...cleanData, createdAt: serverTimestamp() });
};

export const updateTripExpense = async (id: string, data: Partial<Omit<TripExpense, 'id' | 'createdAt'>>) => {
  const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
  return await updateDoc(doc(db, 'trip_expenses', id), cleanData);
};

export const deleteTripExpense = async (id: string) => {
  return await deleteDoc(doc(db, 'trip_expenses', id));
};

// --- Trip Settlements ---

export const createTripSettlement = async (data: Omit<TripSettlement, 'id' | 'createdAt'>) => {
  const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
  return await addDoc(tripSettlementsRef, { ...cleanData, createdAt: serverTimestamp() });
};

export const deleteTripSettlement = async (id: string) => {
  return await deleteDoc(doc(db, 'trip_settlements', id));
};

// --- Friend Requests ---

export const sendFriendRequest = async (
  fromUserId: string,
  toUserId: string,
  fromDisplayName: string,
  fromPhotoURL: string | null,
  toDisplayName: string,
  toPhotoURL: string | null
) => {
  // Check if already sent or already friends
  const existing = await getDocs(
    query(friendRequestsRef,
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId)
    )
  );
  if (!existing.empty) throw new Error('Friend request already sent');

  return await addDoc(friendRequestsRef, {
    fromUserId,
    toUserId,
    fromDisplayName,
    fromPhotoURL,
    toDisplayName,
    toPhotoURL,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const respondFriendRequest = async (requestId: string, status: 'accepted' | 'declined') => {
  return await updateDoc(doc(db, 'friend_requests', requestId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

export const deleteFriendRequest = async (requestId: string) => {
  return await deleteDoc(doc(db, 'friend_requests', requestId));
};

/** Search user by exact email */
export const searchUserByEmail = async (email: string) => {
  const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { uid: docSnap.id, ...docSnap.data() } as { uid: string; displayName: string; email: string; photoURL: string | null };
};

/** Get user profile by uid */
export const getUserProfile = async (uid: string) => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as { uid: string; displayName: string; email: string; photoURL: string | null };
};

// --- Custom Friends (local contacts without app account) ---

export const createCustomFriend = async (userId: string, name: string) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อ');

  return await addDoc(customFriendsRef, {
    userId,
    name: trimmed,
    createdAt: serverTimestamp(),
  });
};

export const deleteCustomFriend = async (id: string) => {
  return await deleteDoc(doc(db, 'custom_friends', id));
};

// --- Categories ---

export const createCategory = async (data: Omit<Category, 'id' | 'createdAt'>) => {
  return await addDoc(categoriesRef, { ...data, createdAt: serverTimestamp() });
};

export const getUserCategories = async (userId: string) => {
  const q = query(categoriesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};
