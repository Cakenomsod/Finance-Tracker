/**
 * Shared types for windowed Firestore queries (Phase 0 foundation).
 * Used by Dashboard, Transactions, Analytics, and Paotang hooks.
 */

export type DateWindow = {
  /** Inclusive start (start of day, local timezone). */
  start: Date;
  /** Inclusive end (end of day, local timezone). */
  end: Date;
  /** Debug label, e.g. `"2025-06-19..2025-06-25"`. */
  label: string;
};

export type WindowedQueryState<T> = {
  items: T[];
  loading: boolean;
  error: Error | null;
  /** Start of the oldest loaded window. */
  oldestLoaded: Date | null;
  /** End of the newest loaded window. */
  newestLoaded: Date | null;
  hasMoreOlder: boolean;
  loadOlder: () => void;
  /** Optional — refresh the most recent window. */
  loadNewer?: () => void;
};

export type AnalyticsRange = '1month' | '3months' | '6months' | '1year';

export type { MonthSelection } from '@/lib/datetime';
