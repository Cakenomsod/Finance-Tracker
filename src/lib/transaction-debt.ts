import { query, where, getDocs } from 'firebase/firestore';
import { debtsRef, createDebt, deleteDebt } from './firestore';
import { Transaction } from './firestore-types';
import {
  computePaotangOweToPayer,
  getTransactionEffectiveAmount,
  isPaotangPaidByOther,
} from './transaction-payment';

/** 50/50 split between payer and one other person */
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
  | 'description'
  | 'paymentMethod'
  | 'paotangSubsidy'
  | 'paotangUserPaid'
>;

export function shouldSyncTransactionDebt(data: DebtSyncData): boolean {
  if (data.type !== 'expense') return false;
  if (data.category === 'Income') return false;
  return true;
}

function getDebtShareAmount(data: DebtSyncData): number {
  if (data.paymentMethod === 'paotang' && isPaotangPaidByOther(data.paidBy)) {
    return computePaotangOweToPayer(data.amount);
  }
  return splitShareAmount(getTransactionEffectiveAmount(data));
}

export async function syncTransactionDebts(
  userId: string,
  txId: string,
  data: DebtSyncData
): Promise<void> {
  await deleteTransactionDebts(txId);

  if (!shouldSyncTransactionDebt(data)) return;

  const share = getDebtShareAmount(data);
  if (share <= 0) return;

  const debtBase = {
    amount: share,
    relatedTxIds: [txId],
    description: data.description,
  };

  if ((data.paidBy === 'Me' || !data.paidBy) && data.splitWith) {
    await createDebt({
      ...debtBase,
      fromUserId: data.splitWith,
      toUserId: userId,
      fromDisplayName: data.splitWith,
      toDisplayName: 'Me',
    });
  } else if (data.paidBy && data.paidBy !== 'Me') {
    await createDebt({
      ...debtBase,
      fromUserId: userId,
      toUserId: data.paidBy,
      fromDisplayName: 'Me',
      toDisplayName: data.paidBy,
    });
  }
}
