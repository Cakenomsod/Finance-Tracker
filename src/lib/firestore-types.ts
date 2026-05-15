import { Timestamp } from 'firebase/firestore';

// users/{userId}
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  partnerId: string | null;
  currency: string;         // default: "THB"
  defaultCategories: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// transactions/{txId}
export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: Timestamp;
  paidBy: string;
  splitWith: string | null;
  tripId: string | null;
  receiptUrl: string | null;
  source: 'manual' | 'line' | 'ocr';
  createdAt: Timestamp;
}

// debts/{debtId}
export interface Debt {
  id?: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  relatedTxIds: string[];
  status: 'pending' | 'settled';
  settledAt: Timestamp | null;
  createdAt: Timestamp;
}

// trips/{tripId}
export interface Trip {
  id?: string;
  name: string;
  description: string;
  members: string[];
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'closed';
  createdBy: string;
  createdAt: Timestamp;
}

// categories/{categoryId}
export interface Category {
  id?: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  createdAt: Timestamp;
}
