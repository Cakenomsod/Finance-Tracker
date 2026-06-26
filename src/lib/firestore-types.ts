import { Timestamp } from 'firebase/firestore';

export type AiTextProvider = 'gemma' | 'local';
export type ExpenseSource = 'manual' | 'ocr' | 'ai' | 'line';
export type PaymentMethod = 'normal' | 'paotang';

export interface ImmichSettings {
  baseUrl: string;
  apiKey: string;
  lastVerifiedAt?: Timestamp;
}

// users/{userId}
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  partnerId: string | null;
  currency: string;
  /** User language preference (en | th) */
  locale?: string;
  defaultCategories: string[];
  immich?: ImmichSettings;
  aiTextProvider?: AiTextProvider;
  localAiBaseUrl?: string;
  /** Immich album for non-trip receipt attachments */
  immichGeneralAlbumId?: string | null;
  /** User-defined display order for friends & custom contacts (uid or custom:{id}) */
  contactOrder?: string[];
  /** Nicknames per app-friend uid for AI matching and display */
  friendAliases?: Record<string, string[]>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TripCurrency = 'THB' | 'JPY';
export type TripCountryCode = 'TH' | 'JP';
export type TaxCategoryId = 'food' | 'goods' | 'standard' | 'exempt';
export type TaxMode = 'exclusive' | 'inclusive';

export interface ReceiptItem {
  name: string;
  category: string;
  price: number;
  tax: number;
  splitWith: string[]; // List of member userIds sharing this specific item
  taxCategoryId?: TaxCategoryId;
  taxRate?: number;
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
  /** Multi-payer split (display name or Me in userId); preferred over splitWith */
  payers?: TripExpensePayer[];
  shares?: TripExpenseShare[];
  splitMode?: 'equal' | 'custom' | 'solo';
  tripId: string | null;
  receiptUrl: string | null;
  source: ExpenseSource;
  tripExpenseId?: string | null;
  immichAssetId?: string | null;
  /** Additional receipt images (Immich); primary/thumbnail uses first id or immichAssetId */
  immichAssetIds?: string[] | null;
  createdAt: Timestamp;
  items?: ReceiptItem[];
  baseAmount?: number;
  taxAmount?: number;
  /** Discount applied before final amount (positive number) */
  discount?: number;
  currency?: TripCurrency;
  /** How the expense was paid — transactions only (not trip expenses) */
  paymentMethod?: PaymentMethod;
  /** Paotang: gov share at save time (after quota caps) */
  paotangSubsidy?: number | null;
  /** Paotang: user share at save time (after quota caps) */
  paotangUserPaid?: number | null;
  /** Paotang: 60% ideal gov share before quota caps */
  paotangIdealSubsidy?: number | null;
  /** True when gov subsidy was reduced due to quota limits */
  paotangQuotaCapped?: boolean;
  paotangCapReason?: 'daily' | 'monthly' | 'total' | null;
  /** When false, transaction is recorded but no friend debts are created */
  debtTracking?: boolean;
  /** Set when this row is a debt repayment (counts in cash flow) */
  debtPaymentDebtId?: string | null;
  note?: string;
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
  /** What the debt is for (e.g. transaction description) */
  description?: string;
  fromDisplayName?: string;
  toDisplayName?: string;
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
  /** Tax jurisdiction for receipt auto-calculation */
  countryCode?: TripCountryCode;
  /** Primary currency for expenses on this trip */
  tripCurrency?: TripCurrency;
  /** Currency used for totals/settlement display */
  homeCurrency?: TripCurrency;
  /** 1 tripCurrency = exchangeRate homeCurrency */
  exchangeRate?: number;
  /** Shared Immich album for this trip's receipt photos */
  immichAlbumId?: string | null;
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
  splitMode: 'equal' | 'custom' | 'solo' | 'item';
  createdAt: Timestamp;
  items?: ReceiptItem[];
  baseAmount?: number;
  taxAmount?: number;
  taxMode?: TaxMode;
  currency?: TripCurrency;
  transactionId?: string | null;
  immichAssetId?: string | null;
  immichAssetIds?: string[] | null;
  source?: ExpenseSource;
}

// trip_ai_messages/{messageId}
export interface TripAiMessage {
  id?: string;
  tripId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'image' | 'expense_draft';
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
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

/** custom_friends/{id} — local-only contacts without an app account */
export interface CustomFriend {
  id?: string;
  userId: string;
  name: string;
  /** Nicknames for AI / informal reference (e.g. เบล) */
  aliases?: string[];
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
  monthlyBudget?: number;
  createdAt: Timestamp;
}

export type RecurringFrequencyUnit = 'daily' | 'weekly' | 'monthly' | 'yearly';
/** @deprecated Use RecurringFrequencyUnit */
export type RecurringFrequency = RecurringFrequencyUnit;

// recurring_expenses/{id}
export interface RecurringExpense {
  id?: string;
  userId: string;
  name: string;
  amount: number;
  frequency: RecurringFrequencyUnit;
  /** Pay every N units (default 1) */
  frequencyInterval?: number;
  nextDate: Timestamp;
  category?: string;
  createdAt: Timestamp;
}
