import { Timestamp } from 'firebase/firestore';
import { Debt, Transaction } from './firestore-types';

export const DEBT_PAYMENT_CATEGORY = 'หนี้';

export function isDebtPaymentTransaction(
  tx: Pick<Transaction, 'debtPaymentDebtId'>
): boolean {
  return !!tx.debtPaymentDebtId;
}

export function formatDebtPaymentDescription(personName: string, amount: number): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `จ่ายหนี้ให้ ${personName} จำนวนเงิน ${formatted}`;
}

export function formatDebtReceiptDescription(personName: string, amount: number): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `รับเงินคืนจาก ${personName} จำนวนเงิน ${formatted}`;
}

/** Record cash-flow impact when a debt is settled (expense when paying, income when receiving). */
export async function createDebtSettlementTransaction(
  userId: string,
  params: {
    amount: number;
    /** True when the current user is paying out */
    isPayer: boolean;
    counterpartyName: string;
    debtId?: string;
    note?: string;
    date?: Timestamp;
    /** Payment source used when settling (payer) or receiving into (receiver) */
    accountId?: string;
    moneyPoolId?: string;
  }
) {
  // Lazy-load client Firestore helpers so server API routes can import pure
  // helpers from this module without initializing the browser Firebase SDK
  // during Next.js "Collecting page data".
  const { createTransaction } = await import('./firestore');

  const {
    amount,
    isPayer,
    counterpartyName,
    debtId,
    note,
    date = Timestamp.now(),
    accountId,
    moneyPoolId,
  } = params;

  const absAmount = Math.abs(amount);
  if (absAmount <= 0) return null;

  if (isPayer) {
    return createTransaction({
      userId,
      amount: -absAmount,
      type: 'expense',
      category: DEBT_PAYMENT_CATEGORY,
      description: formatDebtPaymentDescription(counterpartyName, absAmount),
      date,
      paidBy: 'Me',
      splitWith: null,
      tripId: null,
      receiptUrl: null,
      source: 'manual',
      debtPaymentDebtId: debtId ?? null,
      debtTracking: false,
      note,
      currency: 'THB',
      accountId: accountId || undefined,
      moneyPoolId: moneyPoolId || undefined,
    });
  }

  return createTransaction({
    userId,
    amount: absAmount,
    type: 'income',
    category: 'Income',
    description: formatDebtReceiptDescription(counterpartyName, absAmount),
    date,
    paidBy: counterpartyName,
    splitWith: null,
    tripId: null,
    receiptUrl: null,
    source: 'manual',
    debtPaymentDebtId: debtId ?? null,
    debtTracking: false,
    note,
    currency: 'THB',
    accountId: accountId || undefined,
    moneyPoolId: moneyPoolId || undefined,
  });
}

export async function recordDebtSettlementCashFlow(
  userId: string,
  debt: Pick<
    Debt,
    'id' | 'fromUserId' | 'toUserId' | 'fromDisplayName' | 'toDisplayName'
  >,
  payAmount: number,
  options?: {
    note?: string;
    date?: Timestamp;
    accountId?: string;
    moneyPoolId?: string;
  }
) {
  const isPayer = debt.fromUserId === userId;
  const isReceiver = debt.toUserId === userId;
  if (!isPayer && !isReceiver) return null;

  const counterpartyName = isPayer
    ? debt.toDisplayName || debt.toUserId
    : debt.fromDisplayName || debt.fromUserId;

  return createDebtSettlementTransaction(userId, {
    amount: payAmount,
    isPayer,
    counterpartyName,
    debtId: debt.id,
    note: options?.note,
    date: options?.date,
    accountId: options?.accountId,
    moneyPoolId: options?.moneyPoolId,
  });
}
