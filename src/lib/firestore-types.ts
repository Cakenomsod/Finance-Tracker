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
  /** Prefer weekly AI insights generation */
  aiInsightsWeekly?: boolean;
  /** Prefer monthly AI insights generation */
  aiInsightsMonthly?: boolean;
  /** Immich album for this user's receipt photos (one album per user) */
  immichUserAlbumId?: string | null;
  /**
   * Legacy alias of immichUserAlbumId (same id). Kept for backward compatibility;
   * new uploads prefer immichUserAlbumId and write both.
   */
  immichGeneralAlbumId?: string | null;
  /** User-defined display order for friends & custom contacts (uid or custom:{id}) */
  contactOrder?: string[];
  /** Nicknames per app-friend uid for AI matching and display */
  friendAliases?: Record<string, string[]>;
  /** Enable bank account / debit / cash tracking */
  accountsEnabled?: boolean;
  /** Enable money pool (envelope) tracking */
  moneyPoolsEnabled?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AiInsightPeriodType = 'week' | 'month';

export interface AiInsightHighlight {
  type: 'warning' | 'insight' | 'positive';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  amount?: number;
  change?: string;
}

export interface AiInsightTip {
  title: string;
  description: string;
  potentialSavings?: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface AiInsightAnomaly {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AiInsightStats {
  totalIncome: number;
  totalExpense: number;
  net: number;
  transactionCount: number;
  topCategories: { name: string; amount: number; percent: number }[];
  vsPriorExpenseChangePercent?: number | null;
  savingsRate?: number | null;
}

/** users/{uid}/ai_insights/{periodKey} */
export interface AiInsightReport {
  id: string; // same as periodKey
  userId: string;
  periodType: AiInsightPeriodType;
  periodKey: string;
  year: number;
  month?: number; // 1-12 for month
  weekStart?: string; // YYYY-MM-DD for week
  weekEnd?: string;
  summary: string;
  highlights: AiInsightHighlight[];
  tips: AiInsightTip[];
  anomalies: AiInsightAnomaly[];
  stats: AiInsightStats;
  status: 'ready' | 'generating' | 'failed';
  errorMessage?: string | null;
  provider?: string;
  model?: string;
  locale?: string;
  generatedAt: Timestamp;
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

export type PaymentSourceType = 'bank_account' | 'debit_card' | 'cash';
export type TransactionType = 'income' | 'expense' | 'transfer';

// payment_sources/{id}
export interface PaymentSource {
  id?: string;
  userId: string;
  type: PaymentSourceType;
  /** User-defined display name */
  name: string;
  /** Thai bank catalog code — not used for cash */
  bankCode?: string;
  branchName?: string;
  accountNumber?: string;
  /** Debit card → linked bank account */
  linkedSourceId?: string;
  openingBalance: number;
  isDefault?: boolean;
  /** User-defined display order (lower = first) */
  sortOrder?: number;
  color?: string;
  icon?: string;
  archived?: boolean;
  createdAt: Timestamp;
}

/** Display-only: where a pool's money currently sits across accounts. */
export interface MoneyPoolAccountAllocation {
  accountId: string;
  amount: number;
}

// money_pools/{id}
export interface MoneyPool {
  id?: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  openingBalance: number;
  targetAmount?: number;
  /**
   * Optional display breakdown of which payment sources hold this pool's money.
   * Does not affect ledger math — accounts remain the source of truth for totals.
   */
  accountAllocations?: MoneyPoolAccountAllocation[];
  archived?: boolean;
  createdAt: Timestamp;
}

// transactions/{txId}
export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: TransactionType;
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
  /** Payment source (bank account, debit card, or cash) */
  accountId?: string;
  /** Money pool / envelope tag */
  moneyPoolId?: string;
  /** Transfer destination account */
  transferToAccountId?: string;
  /** Transfer destination money pool */
  transferToPoolId?: string;
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
  /**
   * Legacy Immich album id for this trip. Unused for new uploads
   * (assets go to the uploader's per-user album instead).
   */
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
  /** Discount applied to the grand total (positive number) */
  discount?: number;
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
  /** Default payment source when confirming payment */
  accountId?: string;
  createdAt: Timestamp;
}
