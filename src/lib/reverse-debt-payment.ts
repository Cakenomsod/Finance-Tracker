import { doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import {
  deleteTripSettlement,
  tripSettlementsRef,
  updateDebt,
} from './firestore';
import { Debt, Transaction, TripSettlement } from './firestore-types';
import { isDebtPaymentTransaction } from './debt-payment';

function paymentAmount(tx: Transaction): number {
  return Math.abs(tx.amount);
}

function txDateMillis(tx: Transaction): number {
  if (tx.date?.toMillis) return tx.date.toMillis();
  if (tx.date?.seconds != null) return tx.date.seconds * 1000;
  return 0;
}

export function resolveDebtPaymentDebtId(tx: Transaction): string | null {
  if (tx.debtPaymentDebtId) return tx.debtPaymentDebtId;
  if (tx.note?.startsWith('debt:')) return tx.note.slice(5);
  return null;
}

export function isDebtPaymentRow(tx: Transaction): boolean {
  if (isDebtPaymentTransaction(tx)) return true;
  if (tx.note === 'trip-debt') return true;
  if (tx.note?.startsWith('debt:')) return true;
  return false;
}

async function findManualDebtSettlements(
  debtId: string,
  amount: number,
  txMillis: number
): Promise<TripSettlement[]> {
  const snap = await getDocs(
    query(tripSettlementsRef, where('note', '==', `debt:${debtId}`))
  );
  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TripSettlement)
    .filter((s) => Math.abs(s.amount - amount) < 0.01);

  if (matches.length === 0) return [];

  matches.sort(
    (a, b) =>
      Math.abs(a.date.toMillis() - txMillis) - Math.abs(b.date.toMillis() - txMillis)
  );
  return [matches[0]];
}

async function findTripDebtSettlements(
  userId: string,
  tx: Transaction,
  amount: number,
  txMillis: number
): Promise<TripSettlement[]> {
  const snap = await getDocs(
    query(tripSettlementsRef, where('userId', '==', userId))
  );
  const windowMs = 2 * 60 * 1000;

  const candidates = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TripSettlement)
    .filter((s) => {
      if (!s.tripId) return false;
      const delta = Math.abs(s.date.toMillis() - txMillis);
      return delta <= windowMs;
    });

  if (candidates.length === 0) return [];

  const isPayer = tx.type === 'expense';
  const partyFiltered = candidates.filter((s) => {
    if (isPayer) return s.fromUserId === userId;
    return s.toUserId === userId;
  });

  const pool = partyFiltered.length > 0 ? partyFiltered : candidates;

  const byTime = new Map<number, TripSettlement[]>();
  for (const s of pool) {
    const bucket = Math.floor(s.date.toMillis() / 1000);
    const list = byTime.get(bucket) ?? [];
    list.push(s);
    byTime.set(bucket, list);
  }

  let best: TripSettlement[] = [];
  let bestDelta = Infinity;

  for (const [, group] of byTime) {
    const sum = group.reduce((acc, s) => acc + s.amount, 0);
    if (Math.abs(sum - amount) >= 0.01) continue;
    const delta = Math.abs(group[0].date.toMillis() - txMillis);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = group;
    }
  }

  return best;
}

async function reverseManualDebt(
  debtId: string,
  amount: number
): Promise<void> {
  const debtSnap = await getDoc(doc(db, 'debts', debtId));
  if (!debtSnap.exists()) return;

  const debt = { id: debtSnap.id, ...debtSnap.data() } as Debt;
  const prevPaid = debt.paidAmount ?? 0;
  const nextPaid = Math.max(0, Math.round((prevPaid - amount) * 100) / 100);

  if (debt.status === 'settled') {
    await updateDebt(debtId, {
      status: 'pending',
      settledAt: null,
      paidAmount: nextPaid,
    });
    return;
  }

  const nextAmount = Math.round((debt.amount + amount) * 100) / 100;
  await updateDebt(debtId, {
    amount: nextAmount,
    paidAmount: nextPaid,
    remainingAmount: nextAmount,
  });
}

async function deleteSettlements(settlements: TripSettlement[]): Promise<void> {
  await Promise.all(
    settlements
      .filter((s) => s.id)
      .map((s) => deleteTripSettlement(s.id!))
  );
}

/** Undo debt settlement side-effects when a debt-payment transaction is deleted. */
export async function reverseDebtPaymentOnDelete(
  userId: string,
  tx: Transaction
): Promise<void> {
  if (!isDebtPaymentRow(tx)) return;

  const amount = paymentAmount(tx);
  const txMillis = txDateMillis(tx);
  const debtId = resolveDebtPaymentDebtId(tx);

  if (debtId && !debtId.startsWith('trip-debt-')) {
    const settlements = await findManualDebtSettlements(debtId, amount, txMillis);
    await deleteSettlements(settlements);
    await reverseManualDebt(debtId, amount);
    return;
  }

  if (debtId?.startsWith('trip-debt-') || tx.note === 'trip-debt') {
    const settlements = await findTripDebtSettlements(userId, tx, amount, txMillis);
    await deleteSettlements(settlements);
  }
}

export function findDebtPaymentTransaction(
  transactions: Transaction[],
  settlement: Pick<TripSettlement, 'note' | 'amount' | 'date' | 'tripId'>
): Transaction | undefined {
  const amount = settlement.amount;
  const settleMs = settlement.date.toMillis();
  const debtId = settlement.note?.startsWith('debt:') ? settlement.note.slice(5) : null;

  const matches = transactions.filter((tx) => {
    if (!isDebtPaymentRow(tx)) return false;
    if (Math.abs(paymentAmount(tx) - amount) >= 0.01) return false;
    if (Math.abs(txDateMillis(tx) - settleMs) > 2 * 60 * 1000) return false;
    if (debtId) {
      const txDebtId = resolveDebtPaymentDebtId(tx);
      if (txDebtId && txDebtId !== debtId) return false;
    }
    if (settlement.tripId && tx.note !== 'trip-debt' && !tx.debtPaymentDebtId?.startsWith('trip-debt-')) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) return undefined;

  matches.sort(
    (a, b) =>
      Math.abs(txDateMillis(a) - settleMs) - Math.abs(txDateMillis(b) - settleMs)
  );
  return matches[0];
}

export function findTripBatchDebtPaymentTransaction(
  transactions: Transaction[],
  settlement: Pick<TripSettlement, 'fromUserId' | 'toUserId' | 'date' | 'tripId'>
): Transaction | undefined {
  if (!settlement.tripId) return undefined;

  const settleMs = settlement.date.toMillis();
  const matches = transactions.filter((tx) => {
    if (tx.note !== 'trip-debt' && !tx.debtPaymentDebtId?.startsWith('trip-debt-')) {
      return false;
    }
    if (Math.abs(txDateMillis(tx) - settleMs) > 2 * 60 * 1000) return false;
    const isPayer = tx.type === 'expense';
    if (isPayer && settlement.fromUserId !== tx.userId) return false;
    if (!isPayer && settlement.toUserId !== tx.userId) return false;
    return true;
  });

  if (matches.length === 0) return undefined;

  matches.sort(
    (a, b) =>
      Math.abs(txDateMillis(a) - settleMs) - Math.abs(txDateMillis(b) - settleMs)
  );
  return matches[0];
}

/** Re-open a manual debt after removing a payment record. */
export async function reverseManualDebtPayment(
  debtId: string,
  amount: number
): Promise<void> {
  await reverseManualDebt(debtId, amount);
}

/** Delete a payment-history row when no linked transaction exists (orphan settlement). */
export async function reverseDebtPaymentFromSettlement(
  settlement: TripSettlement
): Promise<void> {
  const debtId = settlement.note?.startsWith('debt:') ? settlement.note.slice(5) : null;
  if (settlement.id) {
    await deleteTripSettlement(settlement.id);
  }
  if (debtId) {
    await reverseManualDebt(debtId, settlement.amount);
  }
}
