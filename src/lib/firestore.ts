import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, Debt, Trip, Category } from './firestore-types';

// Collection References
export const usersRef = collection(db, 'users');
export const transactionsRef = collection(db, 'transactions');
export const debtsRef = collection(db, 'debts');
export const tripsRef = collection(db, 'trips');
export const categoriesRef = collection(db, 'categories');

// --- Transactions ---

export const createTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
  return await addDoc(transactionsRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getUserTransactions = async (userId: string) => {
  const q = query(transactionsRef, where('userId', '==', userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
};

export const updateTransaction = async (id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'transactions', id);
  return await updateDoc(docRef, data);
};

export const deleteTransaction = async (id: string) => {
  const docRef = doc(db, 'transactions', id);
  return await deleteDoc(docRef);
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
  const docRef = doc(db, 'debts', id);
  return await updateDoc(docRef, data);
};

export const deleteDebt = async (id: string) => {
  const docRef = doc(db, 'debts', id);
  return await deleteDoc(docRef);
};

// --- Trips ---

export const createTrip = async (data: Omit<Trip, 'id' | 'createdAt'>) => {
  return await addDoc(tripsRef, {
    ...data,
    createdAt: serverTimestamp(),
    status: 'active',
  });
};

export const getUserTrips = async (userId: string) => {
  const q = query(tripsRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
};

export const updateTrip = async (id: string, data: Partial<Omit<Trip, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, 'trips', id);
  return await updateDoc(docRef, data);
};

export const deleteTrip = async (id: string) => {
  const docRef = doc(db, 'trips', id);
  return await deleteDoc(docRef);
};

export const closeTrip = async (id: string) => {
  const docRef = doc(db, 'trips', id);
  return await updateDoc(docRef, { status: 'closed' });
};

// --- Categories ---

export const createCategory = async (data: Omit<Category, 'id' | 'createdAt'>) => {
  return await addDoc(categoriesRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getUserCategories = async (userId: string) => {
  const q = query(categoriesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};
