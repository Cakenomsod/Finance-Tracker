import {
  Transaction,
  TripExpensePayer,
  TripExpenseShare,
} from './firestore-types';

export const ME_PERSON_ID = 'Me';

export type TransactionSplitMode = 'solo' | 'equal' | 'custom';

export interface TransactionSplitData {
  payers: TripExpensePayer[];
  shares: TripExpenseShare[];
  splitMode: TransactionSplitMode;
}

export interface SplitTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface TransactionDebtDraft {
  fromUserId: string;
  toUserId: string;
  fromDisplayName: string;
  toDisplayName: string;
  amount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Net balance per person: positive = owed money back, negative = owes money */
export function computeSplitNetBalances(
  payers: TripExpensePayer[],
  shares: TripExpenseShare[]
): Map<string, { displayName: string; net: number }> {
  const net = new Map<string, { displayName: string; net: number }>();

  for (const p of payers) {
    const cur = net.get(p.userId) ?? { displayName: p.displayName, net: 0 };
    cur.net += p.amount;
    net.set(p.userId, cur);
  }
  for (const s of shares) {
    const cur = net.get(s.userId) ?? { displayName: s.displayName, net: 0 };
    cur.net -= s.amount;
    net.set(s.userId, cur);
  }

  for (const [id, entry] of net) {
    entry.net = roundMoney(entry.net);
    net.set(id, entry);
  }

  return net;
}

/** Greedy settlement from net balances */
export function computeSplitTransfers(
  net: Map<string, { displayName: string; net: number }>
): SplitTransfer[] {
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, { net: balance }] of net) {
    if (balance < -0.001) debtors.push({ id, amount: -balance });
    else if (balance > 0.001) creditors.push({ id, amount: balance });
  }

  const transfers: SplitTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const left = debtors[i].amount;
    const right = creditors[j].amount;
    if (!Number.isFinite(left) || !Number.isFinite(right)) break;

    const amount = roundMoney(Math.min(left, right));
    if (amount > 0.001) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    }
    debtors[i].amount = roundMoney(debtors[i].amount - amount);
    creditors[j].amount = roundMoney(creditors[j].amount - amount);
    if (!Number.isFinite(debtors[i].amount) || debtors[i].amount < 0.001) i++;
    if (!Number.isFinite(creditors[j].amount) || creditors[j].amount < 0.001) j++;
  }

  return transfers;
}

function debtUserId(personId: string, meUserId: string): string {
  return personId === ME_PERSON_ID ? meUserId : personId;
}

function debtDisplayName(personId: string, displayName: string): string {
  return personId === ME_PERSON_ID ? 'Me' : displayName;
}

/** Debts involving Me only, for sync to Firestore */
export function computeTransactionSplitDebts(
  meUserId: string,
  payers: TripExpensePayer[],
  shares: TripExpenseShare[],
  netById?: Map<string, { displayName: string; net: number }>
): TransactionDebtDraft[] {
  const net = netById ?? computeSplitNetBalances(payers, shares);
  const names = new Map<string, string>();
  for (const p of payers) names.set(p.userId, p.displayName);
  for (const s of shares) names.set(s.userId, s.displayName);

  const transfers = computeSplitTransfers(net).filter(
    (t) => t.from === ME_PERSON_ID || t.to === ME_PERSON_ID
  );

  return transfers.map((t) => ({
    fromUserId: debtUserId(t.from, meUserId),
    toUserId: debtUserId(t.to, meUserId),
    fromDisplayName: debtDisplayName(t.from, names.get(t.from) || t.from),
    toDisplayName: debtDisplayName(t.to, names.get(t.to) || t.to),
    amount: t.amount,
  }));
}

export function hasTransactionSplit(data: Pick<Transaction, 'payers' | 'shares' | 'splitWith'>): boolean {
  if (data.payers?.length && data.shares?.length) return true;
  return !!data.splitWith;
}

/** Build payers/shares from legacy paidBy + splitWith fields */
export function legacyTransactionToSplit(
  tx: Pick<
    Transaction,
    'amount' | 'type' | 'paidBy' | 'splitWith' | 'paymentMethod' | 'paotangSubsidy' | 'paotangUserPaid'
  >
): TransactionSplitData | null {
  const total = Math.abs(tx.amount);
  if (!total || total <= 0) return null;

  const paidBy = tx.paidBy || ME_PERSON_ID;
  const splitWith = tx.splitWith;

  if (!splitWith) {
    if (paidBy === ME_PERSON_ID) {
      return {
        splitMode: 'solo',
        payers: [{ userId: ME_PERSON_ID, displayName: 'Me', amount: total }],
        shares: [{ userId: ME_PERSON_ID, displayName: 'Me', amount: total }],
      };
    }
    return {
      splitMode: 'solo',
      payers: [{ userId: paidBy, displayName: paidBy, amount: total }],
      shares: [{ userId: ME_PERSON_ID, displayName: 'Me', amount: total }],
    };
  }

  const share = roundMoney(total / 2);
  const people = [ME_PERSON_ID, splitWith];
  return {
    splitMode: 'equal',
    payers: [{ userId: paidBy, displayName: paidBy, amount: total }],
    shares: people.map((id) => ({
      userId: id,
      displayName: id === ME_PERSON_ID ? 'Me' : id,
      amount: share,
    })),
  };
}

export function resolveTransactionSplit(
  tx: Pick<
    Transaction,
    | 'amount'
    | 'type'
    | 'paidBy'
    | 'splitWith'
    | 'payers'
    | 'shares'
    | 'splitMode'
    | 'paymentMethod'
    | 'paotangSubsidy'
    | 'paotangUserPaid'
  >
): TransactionSplitData | null {
  if (tx.payers?.length && tx.shares?.length) {
    return {
      payers: tx.payers,
      shares: tx.shares,
      splitMode: (tx.splitMode as TransactionSplitMode) || 'equal',
    };
  }
  return legacyTransactionToSplit(tx);
}

export function primaryPaidByFromSplit(split: TransactionSplitData): string {
  const top = [...split.payers].sort((a, b) => b.amount - a.amount)[0];
  return top?.displayName || ME_PERSON_ID;
}
