import { Timestamp } from 'firebase/firestore';

// users/{userId}
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  partnerId: string | null;
  currency: string;
  defaultCategories: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReceiptItem {
  name: string;
  category: string;
  price: number;
  tax: number;
  splitWith: string[]; // List of member userIds sharing this specific item
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
  items?: ReceiptItem[];
  baseAmount?: number;
  taxAmount?: number;
  currency?: 'THB' | 'JPY';
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
  // Extended fields (optional — backward compatible)
  tripId?: string;
  sourceExpenseId?: string;
  paidAmount?: number;
  remainingAmount?: number;
}

// trips/{tripId}
export interface MemberProfile {
  displayName: string;
  photoURL: string | null;
}

export interface Trip {
  id?: string;
  name: string;
  description: string;
  /** userId[] for new trips; kept as string[] for legacy name-based trips */
  members: string[];
  /** Cached profile info keyed by userId. Absent in legacy name-based trips. */
  memberProfiles?: Record<string, MemberProfile>;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'closed';
  createdBy: string;
  createdAt: Timestamp;
}

// trip_expenses/{expenseId}
export interface TripExpensePayer {
  userId: string;
  displayName: string;
  amount: number;
}

export interface TripExpenseShare {
  userId: string;
  displayName: string;
  amount: number;
}

export interface TripExpense {
  id?: string;
  tripId: string;
  userId: string;          // creator
  description: string;
  totalAmount: number;
  category: string;
  date: Timestamp;
  note?: string;
  payers: TripExpensePayer[];
  shares: TripExpenseShare[];
  splitMode: 'equal' | 'custom' | 'solo';
  createdAt: Timestamp;
  items?: ReceiptItem[];
  baseAmount?: number;
  taxAmount?: number;
  currency?: 'THB' | 'JPY';
}

// trip_settlements/{settlementId}
export interface TripSettlement {
  id?: string;
  userId: string;          // creator / confirmer
  tripId?: string;         // null = cross-trip or non-trip
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
  date: Timestamp;
  note?: string;
  isPartial: boolean;
  createdAt: Timestamp;
}

export interface FriendRequest {
  id?: string;
  fromUserId: string;
  toUserId: string;
  fromDisplayName: string;
  fromPhotoURL: string | null;
  toDisplayName?: string;
  toPhotoURL?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
