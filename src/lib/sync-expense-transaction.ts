import { Timestamp } from 'firebase/firestore';
import {
  createTripExpense,
  createTransaction,
  updateTripExpense,
  updateTransaction,
  deleteTripExpense,
  deleteTransaction,
} from '@/lib/firestore';
import { ExpenseSource, TripExpense, Transaction } from '@/lib/firestore-types';

function mapExpenseToTransaction(
  expense: Omit<TripExpense, 'id' | 'createdAt'>,
  userId: string,
  expenseId: string,
  options?: { immichAssetId?: string | null; source?: ExpenseSource }
): Omit<Transaction, 'id' | 'createdAt'> {
  const primaryPayer = expense.payers[0];
  const otherShare = expense.shares.find((s) => s.userId !== primaryPayer?.userId);
  const source = options?.source ?? expense.source ?? 'manual';
  const txSource: Transaction['source'] =
    source === 'ai' ? 'ocr' : source === 'line' ? 'line' : source === 'ocr' ? 'ocr' : 'manual';

  return {
    userId,
    amount: -Math.abs(expense.totalAmount),
    type: 'expense',
    category: expense.category,
    description: expense.description,
    date: expense.date,
    paidBy: primaryPayer?.displayName || 'Me',
    splitWith: expense.splitMode === 'solo' ? null : otherShare?.userId || null,
    tripId: expense.tripId,
    receiptUrl: options?.immichAssetId
      ? `/api/immich/asset/${options.immichAssetId}`
      : null,
    source: txSource,
    items: expense.items,
    baseAmount: expense.baseAmount,
    taxAmount: expense.taxAmount,
    currency: expense.currency,
    tripExpenseId: expenseId,
    immichAssetId: options?.immichAssetId ?? expense.immichAssetId ?? null,
  };
}

export async function saveTripExpenseWithTransaction(
  expense: Omit<TripExpense, 'id' | 'createdAt' | 'transactionId'>,
  userId: string,
  options?: { immichAssetId?: string | null; source?: ExpenseSource }
): Promise<{ expenseId: string; transactionId: string }> {
  const expenseRef = await createTripExpense({
    ...expense,
    immichAssetId: options?.immichAssetId ?? expense.immichAssetId ?? null,
    source: options?.source ?? expense.source ?? 'manual',
  });

  const txRef = await createTransaction(
    mapExpenseToTransaction(
      { ...expense, tripId: expense.tripId },
      userId,
      expenseRef.id,
      options
    )
  );

  await updateTripExpense(expenseRef.id, { transactionId: txRef.id });

  return { expenseId: expenseRef.id, transactionId: txRef.id };
}

export async function updateTripExpenseWithTransaction(
  expenseId: string,
  transactionId: string | null | undefined,
  expense: Partial<Omit<TripExpense, 'id' | 'createdAt'>>,
  userId: string,
  options?: { immichAssetId?: string | null; source?: ExpenseSource }
): Promise<void> {
  await updateTripExpense(expenseId, expense);

  if (!transactionId) return;

  if (
    expense.totalAmount !== undefined ||
    expense.category !== undefined ||
    expense.description !== undefined ||
    expense.payers !== undefined
  ) {
    const txUpdate: Partial<Omit<Transaction, 'id' | 'createdAt'>> = {};

    if (expense.totalAmount !== undefined) {
      txUpdate.amount = -Math.abs(expense.totalAmount);
    }
    if (expense.category !== undefined) txUpdate.category = expense.category;
    if (expense.description !== undefined) txUpdate.description = expense.description;
    if (expense.date !== undefined) txUpdate.date = expense.date;
    if (expense.items !== undefined) txUpdate.items = expense.items;
    if (expense.baseAmount !== undefined) txUpdate.baseAmount = expense.baseAmount;
    if (expense.taxAmount !== undefined) txUpdate.taxAmount = expense.taxAmount;
    if (expense.currency !== undefined) txUpdate.currency = expense.currency;

    if (expense.payers?.[0]) {
      txUpdate.paidBy = expense.payers[0].displayName;
    }
    if (expense.shares) {
      const payerId = expense.payers?.[0]?.userId;
      const other = expense.shares.find((s) => s.userId !== payerId);
      txUpdate.splitWith =
        expense.splitMode === 'solo' ? null : other?.userId || null;
    }

    const immichId = options?.immichAssetId ?? expense.immichAssetId;
    if (immichId !== undefined) {
      txUpdate.immichAssetId = immichId;
      txUpdate.receiptUrl = immichId ? `/api/immich/asset/${immichId}` : null;
    }

    if (Object.keys(txUpdate).length > 0) {
      await updateTransaction(transactionId, txUpdate);
    }
  }
}

export async function deleteTripExpenseWithTransaction(
  expenseId: string,
  transactionId?: string | null
): Promise<void> {
  await deleteTripExpense(expenseId);
  if (transactionId) {
    await deleteTransaction(transactionId);
  }
}
