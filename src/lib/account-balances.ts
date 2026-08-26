import { MoneyPool, PaymentSource, Transaction } from '@/lib/firestore-types';
import { toDateFromFirestore } from '@/lib/datetime';
import { getBankByCode } from '@/lib/thai-banks';
import { getTransactionLedgerCashAmount } from '@/lib/transaction-payment';
import {
  AppCurrency,
  convertCurrency,
  isAppCurrency,
  STATIC_FALLBACK_RATES,
} from '@/lib/currency';

export type TransactionType = Transaction['type'];

/** currency code → signed amount in that currency */
export type CurrencyAmountMap = Map<string, number>;

export interface CurrencyBalanceRow {
  currency: string;
  amount: number;
}

/** Resolve debit card selection to linked bank account for ledger posting. */
export function resolveLedgerSourceId(
  sourceId: string | undefined | null,
  sourcesById: Map<string, PaymentSource>
): string | null {
  if (!sourceId) return null;
  const source = sourcesById.get(sourceId);
  if (!source) return sourceId;
  if (source.type === 'debit_card' && source.linkedSourceId) {
    return source.linkedSourceId;
  }
  return sourceId;
}

export function getSourceDisplaySubtitle(source: PaymentSource): string | null {
  if (source.type === 'cash') return null;
  const bank = getBankByCode(source.bankCode);
  const parts: string[] = [];
  if (bank) parts.push(bank.nameTh);
  if (source.branchName?.trim()) parts.push(source.branchName.trim());
  if (source.accountNumber?.trim()) {
    const digits = source.accountNumber.replace(/\D/g, '');
    if (digits.length > 4) {
      parts.push(`•••• ${digits.slice(-4)}`);
    } else if (digits) {
      parts.push(digits);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function resolveTxCurrencyCode(tx: Transaction): string {
  return isAppCurrency(tx.currency) ? tx.currency : 'THB';
}

function applyCurrencyDelta(
  map: Map<string, CurrencyAmountMap>,
  id: string | null,
  currency: string,
  delta: number
) {
  if (!id || delta === 0) return;
  let inner = map.get(id);
  if (!inner) {
    inner = new Map();
    map.set(id, inner);
  }
  inner.set(currency, (inner.get(currency) ?? 0) + delta);
}

function flattenCurrencyMaps(byCurrency: Map<string, CurrencyAmountMap>): Map<string, number> {
  const flat = new Map<string, number>();
  for (const [id, curMap] of byCurrency) {
    let sum = 0;
    for (const amt of curMap.values()) sum += amt;
    flat.set(id, sum);
  }
  return flat;
}

function rowsFromMap(merged: Map<string, number>): CurrencyBalanceRow[] {
  return Array.from(merged.entries())
    .filter(([, amount]) => Math.abs(amount) > 0.001)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

/**
 * Compute running balance deltas per account/pool, split by transaction currency.
 */
export function computeBalanceDeltasByCurrency(
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): {
  accountDeltasByCurrency: Map<string, CurrencyAmountMap>;
  poolDeltasByCurrency: Map<string, CurrencyAmountMap>;
} {
  const accountDeltasByCurrency = new Map<string, CurrencyAmountMap>();
  const poolDeltasByCurrency = new Map<string, CurrencyAmountMap>();

  for (const tx of transactions) {
    const currency = resolveTxCurrencyCode(tx);
    const amount =
      tx.type === 'transfer'
        ? Math.abs(tx.amount)
        : getTransactionLedgerCashAmount(tx);
    if (amount <= 0) continue;

    const fromAccount = resolveLedgerSourceId(tx.accountId, sourcesById);
    const toAccount = resolveLedgerSourceId(tx.transferToAccountId, sourcesById);

    if (tx.type === 'transfer') {
      if (fromAccount) applyCurrencyDelta(accountDeltasByCurrency, fromAccount, currency, -amount);
      if (toAccount) applyCurrencyDelta(accountDeltasByCurrency, toAccount, currency, amount);
      if (tx.moneyPoolId) applyCurrencyDelta(poolDeltasByCurrency, tx.moneyPoolId, currency, -amount);
      if (tx.transferToPoolId) {
        applyCurrencyDelta(poolDeltasByCurrency, tx.transferToPoolId, currency, amount);
      }
      continue;
    }

    if (tx.type === 'income') {
      if (fromAccount) applyCurrencyDelta(accountDeltasByCurrency, fromAccount, currency, amount);
      if (tx.moneyPoolId) applyCurrencyDelta(poolDeltasByCurrency, tx.moneyPoolId, currency, amount);
    } else if (tx.type === 'expense') {
      if (fromAccount) applyCurrencyDelta(accountDeltasByCurrency, fromAccount, currency, -amount);
      if (tx.moneyPoolId) applyCurrencyDelta(poolDeltasByCurrency, tx.moneyPoolId, currency, -amount);
    }
  }

  return { accountDeltasByCurrency, poolDeltasByCurrency };
}

/** Flat deltas — mixes currencies; prefer computeBalanceDeltasByCurrency for display. */
export function computeBalanceDeltas(
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): { accountDeltas: Map<string, number>; poolDeltas: Map<string, number> } {
  const { accountDeltasByCurrency, poolDeltasByCurrency } = computeBalanceDeltasByCurrency(
    transactions,
    sourcesById
  );
  return {
    accountDeltas: flattenCurrencyMaps(accountDeltasByCurrency),
    poolDeltas: flattenCurrencyMaps(poolDeltasByCurrency),
  };
}

function ledgerIdForSource(source: PaymentSource): string {
  if (source.type === 'debit_card' && source.linkedSourceId) return source.linkedSourceId;
  return source.id!;
}

/**
 * Per-currency balances for a ledger source.
 * Opening balance is attributed to `openingCurrency` (default THB).
 */
export function getSourceCurrencyBalances(
  source: PaymentSource,
  accountDeltasByCurrency: Map<string, CurrencyAmountMap>,
  openingCurrency: string = 'THB'
): CurrencyBalanceRow[] {
  const id = ledgerIdForSource(source);
  const deltas = accountDeltasByCurrency.get(id) ?? new Map<string, number>();
  const merged = new Map<string, number>();

  const opening = source.openingBalance ?? 0;
  if (Math.abs(opening) > 0.0001) {
    merged.set(openingCurrency, opening);
  }

  for (const [cur, amt] of deltas) {
    merged.set(cur, (merged.get(cur) ?? 0) + amt);
  }

  if (source.type === 'debit_card' && source.linkedSourceId) {
    const linkedDeltas = accountDeltasByCurrency.get(source.linkedSourceId) ?? new Map();
    const out = new Map<string, number>();
    if (Math.abs(opening) > 0.0001) out.set(openingCurrency, opening);
    for (const [cur, amt] of linkedDeltas) {
      out.set(cur, (out.get(cur) ?? 0) + amt);
    }
    return rowsFromMap(out);
  }

  return rowsFromMap(merged);
}

export function getPoolCurrencyBalances(
  pool: MoneyPool,
  poolDeltasByCurrency: Map<string, CurrencyAmountMap>,
  openingCurrency: string = 'THB'
): CurrencyBalanceRow[] {
  const deltas = pool.id ? poolDeltasByCurrency.get(pool.id) ?? new Map() : new Map();
  const merged = new Map<string, number>();
  const opening = pool.openingBalance ?? 0;
  if (Math.abs(opening) > 0.0001) merged.set(openingCurrency, opening);
  for (const [cur, amt] of deltas) {
    merged.set(cur, (merged.get(cur) ?? 0) + amt);
  }
  return rowsFromMap(merged);
}

/** Aggregate currency rows from multiple sources (e.g. all accounts under a bank). */
export function aggregateCurrencyBalances(rowsList: CurrencyBalanceRow[][]): CurrencyBalanceRow[] {
  const merged = new Map<string, number>();
  for (const rows of rowsList) {
    for (const row of rows) {
      merged.set(row.currency, (merged.get(row.currency) ?? 0) + row.amount);
    }
  }
  return rowsFromMap(merged);
}

export function sumCurrencyBalancesInHome(
  rows: CurrencyBalanceRow[],
  homeCurrency: AppCurrency | string,
  rates: Record<string, number>
): number {
  const home: AppCurrency = isAppCurrency(homeCurrency) ? homeCurrency : 'THB';
  const effectiveRates = { ...STATIC_FALLBACK_RATES, ...rates };
  return rows.reduce((sum, row) => {
    const from: AppCurrency = isAppCurrency(row.currency) ? row.currency : 'THB';
    return sum + convertCurrency(row.amount, from, home, effectiveRates);
  }, 0);
}

export function computeSourceBalance(
  source: PaymentSource,
  accountDeltas: Map<string, number>
): number {
  const id = ledgerIdForSource(source);
  const delta = accountDeltas.get(id) ?? 0;
  if (source.type === 'debit_card') {
    const linked = source.linkedSourceId ? accountDeltas.get(source.linkedSourceId) : undefined;
    if (source.linkedSourceId && linked !== undefined) {
      return (source.openingBalance ?? 0) + (linked ?? 0);
    }
    return (source.openingBalance ?? 0) + delta;
  }
  return (source.openingBalance ?? 0) + (accountDeltas.get(source.id!) ?? 0);
}

export function computePoolBalance(pool: MoneyPool, poolDeltas: Map<string, number>): number {
  return (pool.openingBalance ?? 0) + (poolDeltas.get(pool.id!) ?? 0);
}

export function getLedgerSources(sources: PaymentSource[]): PaymentSource[] {
  return sources.filter(
    (s) => !s.archived && (s.type === 'bank_account' || s.type === 'cash')
  );
}

export function computeTotalLedgerBalance(
  sources: PaymentSource[],
  accountDeltas: Map<string, number>
): number {
  return Math.round(
    getLedgerSources(sources).reduce(
      (sum, s) => sum + computeSourceBalance(s, accountDeltas),
      0
    )
  );
}

export function computeTotalLedgerBalanceInHome(
  sources: PaymentSource[],
  accountDeltasByCurrency: Map<string, CurrencyAmountMap>,
  homeCurrency: AppCurrency | string,
  rates: Record<string, number>,
  openingCurrency: string = 'THB'
): number {
  const home: AppCurrency = isAppCurrency(homeCurrency) ? homeCurrency : 'THB';
  const total = getLedgerSources(sources).reduce((sum, s) => {
    const rows = getSourceCurrencyBalances(s, accountDeltasByCurrency, openingCurrency);
    return sum + sumCurrencyBalancesInHome(rows, home, rates);
  }, 0);
  return Math.round(total);
}

export function computeTotalLedgerBalanceUpToMonth(
  transactions: Transaction[],
  sources: PaymentSource[],
  sourcesById: Map<string, PaymentSource>,
  year: number,
  month: number,
  homeCurrency?: AppCurrency | string,
  rates?: Record<string, number>
): number {
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const scoped = transactions.filter((tx) => {
    const d = toDateFromFirestore(tx.date);
    return d !== null && d <= endOfMonth;
  });
  const { accountDeltasByCurrency } = computeBalanceDeltasByCurrency(scoped, sourcesById);
  if (homeCurrency && rates) {
    return computeTotalLedgerBalanceInHome(
      sources,
      accountDeltasByCurrency,
      homeCurrency,
      rates
    );
  }
  const { accountDeltas } = computeBalanceDeltas(scoped, sourcesById);
  return computeTotalLedgerBalance(sources, accountDeltas);
}

export interface PoolAccountBreakdown {
  accountId: string;
  amount: number;
}

export function computePoolBreakdownByAccount(
  poolId: string,
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): PoolAccountBreakdown[] {
  const breakdown = new Map<string, number>();

  const applyAccountDelta = (deltas: Map<string, number>, sourceId: string | null, delta: number) => {
    if (!sourceId || delta === 0) return;
    deltas.set(sourceId, (deltas.get(sourceId) ?? 0) + delta);
  };

  for (const tx of transactions) {
    const amount =
      tx.type === 'transfer'
        ? Math.abs(tx.amount)
        : getTransactionLedgerCashAmount(tx);
    if (amount <= 0) continue;

    const fromLedger = resolveLedgerSourceId(tx.accountId, sourcesById);
    const toLedger = resolveLedgerSourceId(tx.transferToAccountId, sourcesById);

    if (tx.type === 'transfer') {
      if (tx.moneyPoolId === poolId && fromLedger) {
        applyAccountDelta(breakdown, fromLedger, -amount);
      }
      if (tx.transferToPoolId === poolId) {
        applyAccountDelta(breakdown, toLedger ?? fromLedger, amount);
      }
      continue;
    }

    if (!fromLedger || tx.moneyPoolId !== poolId) continue;
    if (tx.type === 'income') {
      applyAccountDelta(breakdown, fromLedger, amount);
    } else if (tx.type === 'expense') {
      applyAccountDelta(breakdown, fromLedger, -amount);
    }
  }

  return Array.from(breakdown.entries())
    .filter(([, amt]) => amt !== 0)
    .map(([accountId, amount]) => ({ accountId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function resolvePoolAccountBreakdown(
  pool: MoneyPool,
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): PoolAccountBreakdown[] {
  const merged = new Map<string, number>();

  const stored = pool.accountAllocations;
  if (stored && stored.length > 0) {
    for (const row of stored) {
      if (!row.accountId || row.amount === 0) continue;
      merged.set(row.accountId, (merged.get(row.accountId) ?? 0) + row.amount);
    }
  }

  if (pool.id) {
    for (const row of computePoolBreakdownByAccount(pool.id, transactions, sourcesById)) {
      merged.set(row.accountId, (merged.get(row.accountId) ?? 0) + row.amount);
    }
  }

  return Array.from(merged.entries())
    .filter(([, amt]) => Math.abs(amt) > 0.001)
    .map(([accountId, amount]) => ({ accountId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function groupSourcesByBank(sources: PaymentSource[]): Map<string, PaymentSource[]> {
  const groups = new Map<string, PaymentSource[]>();
  for (const source of sources) {
    if (source.archived) continue;
    const key =
      source.type === 'cash'
        ? '__cash__'
        : source.bankCode ?? '__other__';
    const list = groups.get(key) ?? [];
    list.push(source);
    groups.set(key, list);
  }
  return groups;
}

export interface BalanceFilter {
  sourceIds?: Set<string>;
  poolIds?: Set<string>;
  bankCodes?: Set<string>;
}

export function transactionMatchesBalanceFilter(
  tx: Transaction,
  filter: BalanceFilter,
  sourcesById: Map<string, PaymentSource>
): boolean {
  const hasSourceFilter = filter.sourceIds && filter.sourceIds.size > 0;
  const hasPoolFilter = filter.poolIds && filter.poolIds.size > 0;
  const hasBankFilter = filter.bankCodes && filter.bankCodes.size > 0;

  if (!hasSourceFilter && !hasPoolFilter && !hasBankFilter) return true;
  if (tx.type === 'transfer') return false;

  if (hasPoolFilter && tx.moneyPoolId && filter.poolIds!.has(tx.moneyPoolId)) {
    return true;
  }

  if (hasSourceFilter && tx.accountId && filter.sourceIds!.has(tx.accountId)) {
    return true;
  }

  if (hasBankFilter && tx.accountId) {
    const source = sourcesById.get(tx.accountId);
    if (source?.bankCode && filter.bankCodes!.has(source.bankCode)) {
      return true;
    }
  }

  return false;
}
