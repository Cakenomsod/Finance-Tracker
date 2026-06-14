import { query, where, getDocs } from 'firebase/firestore';
import { debtsRef, createDebt, deleteDebt } from './firestore';
import { Transaction } from './firestore-types';
import {
  computePaotangOweToPayer,
  isPaotangPaidByOther,
  toEffectivePayersForDebt,
} from './transaction-payment';
import {
  computeTransactionSplitDebts,
  hasTransactionSplit,
  resolveTransactionSplit,
} from './transaction-split';

/** @deprecated legacy 50/50 helper */
export function splitShareAmount(totalAmount: number): number {
  return Math.round(Math.abs(totalAmount) * 50) / 100;
}

export async function deleteTransactionDebts(txId: string): Promise<void> {
  const q = query(debtsRef, where('relatedTxIds', 'array-contains', txId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDebt(d.id)));
}

type DebtSyncData = Pick<
  Transaction,
  | 'amount'
  | 'type'
  | 'category'
  | 'paidBy'
  | 'splitWith'
  | 'payers'
  | 'shares'
  | 'splitMode'
  | 'description'
  | 'paymentMethod'
  | 'debtTracking'
  | 'paotangSubsidy'
  | 'paotangUserPaid'
>;

export function shouldSyncTransactionDebt(data: DebtSyncData): boolean {
  if (data.type !== 'expense') return false;
  if (data.category === 'Income') return false;
  if (data.debtTracking === false) return false;
  return true;
}

export async function syncTransactionDebts(
  userId: string,
  txId: string,
  data: DebtSyncData
): Promise<void> {
  await deleteTransactionDebts(txId);

  if (!shouldSyncTransactionDebt(data)) return;

  const debtBase = {
    relatedTxIds: [txId],
    description: data.description,
  };

  const split = resolveTransactionSplit(data);
  const hasSplit = split && hasTransactionSplit(data);

  if (hasSplit && split) {
    const payersForDebt = toEffectivePayersForDebt(split.payers, data.paymentMethod);
    const debts = computeTransactionSplitDebts(userId, payersForDebt, split.shares);
    for (const d of debts) {
      if (d.amount <= 0) continue;
      await createDebt({
        ...debtBase,
        amount: d.amount,
        fromUserId: d.fromUserId,
        toUserId: d.toUserId,
        fromDisplayName: d.fromDisplayName,
        toDisplayName: d.toDisplayName,
      });
    }
    return;
  }

  if (data.paymentMethod === 'paotang' && isPaotangPaidByOther(data.paidBy)) {
    const share = computePaotangOweToPayer(data.amount);
    if (share <= 0) return;
    await createDebt({
      ...debtBase,
      amount: share,
      fromUserId: userId,
      toUserId: data.paidBy!,
      fromDisplayName: 'Me',
      toDisplayName: data.paidBy!,
    });
  }
}
