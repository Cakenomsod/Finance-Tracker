import { MoneyPool, PaymentSource, Transaction } from '@/lib/firestore-types';
import { getBankByCode } from '@/lib/thai-banks';

export type TransactionType = Transaction['type'];

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

function applyAccountDelta(
  deltas: Map<string, number>,
  sourceId: string | null,
  delta: number
) {
  if (!sourceId || delta === 0) return;
  deltas.set(sourceId, (deltas.get(sourceId) ?? 0) + delta);
}

function applyPoolDelta(deltas: Map<string, number>, poolId: string | null, delta: number) {
  if (!poolId || delta === 0) return;
  deltas.set(poolId, (deltas.get(poolId) ?? 0) + delta);
}

/** Compute running balance deltas from transactions for accounts and pools. */
export function computeBalanceDeltas(
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): { accountDeltas: Map<string, number>; poolDeltas: Map<string, number> } {
  const accountDeltas = new Map<string, number>();
  const poolDeltas = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    if (amount <= 0) continue;

    const fromAccount = resolveLedgerSourceId(tx.accountId, sourcesById);
    const toAccount = resolveLedgerSourceId(tx.transferToAccountId, sourcesById);

    if (tx.type === 'transfer') {
      if (fromAccount) applyAccountDelta(accountDeltas, fromAccount, -amount);
      if (toAccount) applyAccountDelta(accountDeltas, toAccount, amount);
      if (tx.moneyPoolId) applyPoolDelta(poolDeltas, tx.moneyPoolId, -amount);
      if (tx.transferToPoolId) applyPoolDelta(poolDeltas, tx.transferToPoolId, amount);
      continue;
    }

    if (tx.type === 'income') {
      if (fromAccount) applyAccountDelta(accountDeltas, fromAccount, amount);
      if (tx.moneyPoolId) applyPoolDelta(poolDeltas, tx.moneyPoolId, amount);
    } else if (tx.type === 'expense') {
      if (fromAccount) applyAccountDelta(accountDeltas, fromAccount, -amount);
      if (tx.moneyPoolId) applyPoolDelta(poolDeltas, tx.moneyPoolId, -amount);
    }
  }

  return { accountDeltas, poolDeltas };
}

export function computeSourceBalance(
  source: PaymentSource,
  accountDeltas: Map<string, number>
): number {
  const id = source.type === 'debit_card' && source.linkedSourceId
    ? source.linkedSourceId
    : source.id!;
  const delta = accountDeltas.get(id) ?? 0;
  if (source.type === 'debit_card') {
    // Debit cards don't hold separate balance; show linked account balance
    const linked = source.linkedSourceId ? accountDeltas.get(source.linkedSourceId) : undefined;
    if (source.linkedSourceId && linked !== undefined) {
      // Return linked balance only when displaying debit as proxy — use opening from linked in overview
      return (source.openingBalance ?? 0) + (linked ?? 0);
    }
    return (source.openingBalance ?? 0) + delta;
  }
  return (source.openingBalance ?? 0) + (accountDeltas.get(source.id!) ?? 0);
}

export function computePoolBalance(pool: MoneyPool, poolDeltas: Map<string, number>): number {
  return (pool.openingBalance ?? 0) + (poolDeltas.get(pool.id!) ?? 0);
}

export interface PoolAccountBreakdown {
  accountId: string;
  amount: number;
}

/** How much of a pool's tagged money sits in each ledger account (dual-tag). */
export function computePoolBreakdownByAccount(
  poolId: string,
  transactions: Transaction[],
  sourcesById: Map<string, PaymentSource>
): PoolAccountBreakdown[] {
  const breakdown = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    if (amount <= 0) continue;

    const ledgerId = resolveLedgerSourceId(tx.accountId, sourcesById);
    if (!ledgerId) continue;

    if (tx.type === 'transfer') {
      if (tx.moneyPoolId === poolId) {
        applyAccountDelta(breakdown, ledgerId, -amount);
      }
      if (tx.transferToPoolId === poolId) {
        applyAccountDelta(breakdown, ledgerId, amount);
      }
      continue;
    }

    if (tx.moneyPoolId !== poolId) continue;
    if (tx.type === 'income') {
      applyAccountDelta(breakdown, ledgerId, amount);
    } else if (tx.type === 'expense') {
      applyAccountDelta(breakdown, ledgerId, -amount);
    }
  }

  return Array.from(breakdown.entries())
    .filter(([, amt]) => amt !== 0)
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
