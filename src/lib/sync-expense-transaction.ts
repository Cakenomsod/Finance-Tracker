import {
  createTripExpense,
  createTransaction,
  updateTripExpense,
  updateTransaction,
  deleteTripExpense,
  deleteTransaction,
} from '@/lib/firestore';
import { collectImmichAssetIds } from '@/lib/immich/asset-ids';
import { ExpenseSource, TripExpense, Transaction } from '@/lib/firestore-types';
import { deleteField } from 'firebase/firestore';

export type ImmichSyncOptions = {
  immichAssetId?: string | null;
  immichAssetIds?: string[] | null;
  source?: ExpenseSource;
};

function resolveImmichIds(
  expense: Partial<TripExpense> | Omit<TripExpense, 'id' | 'createdAt'>,
  options?: ImmichSyncOptions
): { ids: string[]; primary: string | null } {
  const ids = collectImmichAssetIds({
    immichAssetId: options?.immichAssetId ?? (expense as TripExpense).immichAssetId,
    immichAssetIds: options?.immichAssetIds ?? (expense as TripExpense).immichAssetIds,
  });
  return { ids, primary: ids[0] ?? null };
}

function mapExpenseToTransaction(
  expense: Omit<TripExpense, 'id' | 'createdAt'>,
  userId: string,
  expenseId: string,
  options?: ImmichSyncOptions
): Omit<Transaction, 'id' | 'createdAt'> {
  const primaryPayer = expense.payers[0];
  const otherShare = expense.shares.find((s) => s.userId !== primaryPayer?.userId);
  const source = options?.source ?? expense.source ?? 'manual';
  const txSource: Transaction['source'] =
    source === 'ai' ? 'ocr' : source === 'line' ? 'line' : source === 'ocr' ? 'ocr' : 'manual';

  const { ids, primary } = resolveImmichIds(expense, options);

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
    receiptUrl: primary ? `/api/immich/asset/${primary}` : null,
    source: txSource,
    items: expense.items,
    baseAmount: expense.baseAmount,
    taxAmount: expense.taxAmount,
    ...(expense.discount && expense.discount > 0 ? { discount: expense.discount } : {}),
    currency: expense.currency,
    tripExpenseId: expenseId,
    immichAssetId: primary,
    ...(ids.length ? { immichAssetIds: ids } : {}),
    ...(expense.note ? { note: expense.note } : {}),
  };
}

export async function saveTripExpenseWithTransaction(
  expense: Omit<TripExpense, 'id' | 'createdAt' | 'transactionId'>,
  userId: string,
  options?: ImmichSyncOptions
): Promise<{ expenseId: string; transactionId: string }> {
  const { ids, primary } = resolveImmichIds(expense, options);

  const expenseRef = await createTripExpense({
    ...expense,
    immichAssetId: primary,
    ...(ids.length ? { immichAssetIds: ids } : {}),
    source: options?.source ?? expense.source ?? 'manual',
  });

  const txRef = await createTransaction(
    mapExpenseToTransaction({ ...expense, tripId: expense.tripId }, userId, expenseRef.id, options)
  );

  await updateTripExpense(expenseRef.id, { transactionId: txRef.id });

  return { expenseId: expenseRef.id, transactionId: txRef.id };
}

export async function updateTripExpenseWithTransaction(
  expenseId: string,
  transactionId: string | null | undefined,
  expense: Partial<Omit<TripExpense, 'id' | 'createdAt'>>,
  options?: ImmichSyncOptions
): Promise<void> {
  const touchImmich =
    options?.immichAssetId !== undefined ||
    options?.immichAssetIds !== undefined ||
    expense.immichAssetId !== undefined ||
    expense.immichAssetIds !== undefined;

  const { ids, primary } = resolveImmichIds(expense, options);

  const patch: Partial<Omit<TripExpense, 'id' | 'createdAt'>> = { ...expense };
  if (touchImmich) {
    patch.immichAssetId = primary;
    patch.immichAssetIds = ids.length ? ids : undefined;
  }

  if (expense.discount !== undefined && !(expense.discount > 0)) {
    (patch as Record<string, unknown>).discount = deleteField();
  }

  await updateTripExpense(expenseId, patch);

  if (!transactionId) return;

  const txUpdate: Partial<Omit<Transaction, 'id' | 'createdAt'>> = {};

  if (expense.totalAmount !== undefined) {
    txUpdate.amount = -Math.abs(expense.totalAmount);
  }
  if (expense.category !== undefined) txUpdate.category = expense.category;
  if (expense.description !== undefined) txUpdate.description = expense.description;
  if (expense.note !== undefined) txUpdate.note = expense.note || undefined;
  if (expense.date !== undefined) txUpdate.date = expense.date;
  if (expense.items !== undefined) txUpdate.items = expense.items;
  if (expense.baseAmount !== undefined) txUpdate.baseAmount = expense.baseAmount;
  if (expense.taxAmount !== undefined) txUpdate.taxAmount = expense.taxAmount;
  if (expense.discount !== undefined) {
    txUpdate.discount =
      expense.discount > 0
        ? expense.discount
        : (deleteField() as unknown as number);
  }
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

  if (touchImmich) {
    txUpdate.immichAssetId = primary;
    txUpdate.immichAssetIds = ids.length ? ids : undefined;
    txUpdate.receiptUrl = primary ? `/api/immich/asset/${primary}` : null;
  }

  if (Object.keys(txUpdate).length > 0) {
    await updateTransaction(transactionId, txUpdate);
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
