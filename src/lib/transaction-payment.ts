import { PaymentMethod, Transaction, TripExpensePayer } from './firestore-types';

/** Fixed Paotang co-payment split (government wallet subsidy programs) */
export const PAOTANG_GOV_PERCENT = 60;
export const PAOTANG_USER_PERCENT = 40;

/** Lifetime gov subsidy quota (THB) — applies when Me pays */
export const PAOTANG_TOTAL_QUOTA = 4000;
/** Monthly gov subsidy quota — applies when Me pays; unused amount does not roll over */
export const PAOTANG_MONTHLY_QUOTA = 1000;
/** Max gov subsidy per calendar day (THB) per person */
export const PAOTANG_DAILY_GOV_MAX = 200;

export type PaotangCapReason = 'daily' | 'monthly' | 'total';
export type PaotangQuotaMode = 'self' | 'payer-other';

type PaymentFields = Pick<
  Transaction,
  | 'amount'
  | 'type'
  | 'paymentMethod'
  | 'paidBy'
  | 'payers'
  | 'shares'
  | 'debtTracking'
  | 'paotangSubsidy'
  | 'paotangUserPaid'
>;

const ME_PERSON_ID = 'Me';

export interface PaotangQuotaUsage {
  totalUsed: number;
  monthUsed: number;
  dayUsed: number;
}

export interface PaotangSplitResult {
  subsidy: number;
  userPaid: number;
  idealSubsidy: number;
  capped: boolean;
  capReason?: PaotangCapReason;
  /** Amount Me owes the payer (40% when someone else paid) */
  oweToPayer?: number;
  remaining: {
    total: number;
    month: number;
    day: number;
  };
}

export function isPaotangPayment(
  tx: Pick<Transaction, 'paymentMethod'>
): tx is Transaction & { paymentMethod: 'paotang' } {
  return tx.paymentMethod === 'paotang';
}

export function normalizePaotangQuotaOwner(paidBy?: string | null): string {
  return !paidBy || paidBy === 'Me' ? 'Me' : paidBy;
}

export function isPaotangPaidByOther(paidBy?: string | null): boolean {
  return normalizePaotangQuotaOwner(paidBy) !== 'Me';
}

export function getPaotangQuotaMode(paidBy?: string | null): PaotangQuotaMode {
  return isPaotangPaidByOther(paidBy) ? 'payer-other' : 'self';
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPaotangSubsidyFromTx(tx: Transaction): number {
  if (tx.paotangSubsidy != null && tx.paotangSubsidy >= 0) {
    return tx.paotangSubsidy;
  }
  return computePaotangIdealSplit(Math.abs(tx.amount)).subsidy;
}

/** 60/40 split without quota caps */
export function computePaotangIdealSplit(total: number): {
  subsidy: number;
  userPaid: number;
} {
  const absTotal = Math.abs(total);
  const userPaid = roundMoney(absTotal * PAOTANG_USER_PERCENT / 100);
  const subsidy = roundMoney(absTotal - userPaid);
  return { subsidy, userPaid };
}

/** @deprecated use computePaotangIdealSplit */
export function computePaotangSplit(total: number) {
  return computePaotangIdealSplit(total);
}

/** Me's share to repay when someone else paid with Paotang (always 40%) */
export function computePaotangOweToPayer(total: number): number {
  return computePaotangIdealSplit(total).userPaid;
}

export function getPaotangUsageFromTransactions(
  transactions: Transaction[],
  options?: {
    excludeTxId?: string;
    forDate?: Date;
    /** Whose Paotang wallet quota to track (Me or payer display name) */
    quotaOwner?: string;
  }
): PaotangQuotaUsage {
  const { excludeTxId, forDate } = options ?? {};
  const owner = normalizePaotangQuotaOwner(options?.quotaOwner);
  const monthKey = forDate ? toMonthKey(forDate) : null;
  const dayKey = forDate ? toDayKey(forDate) : null;

  let totalUsed = 0;
  let monthUsed = 0;
  let dayUsed = 0;

  for (const tx of transactions) {
    if (!isPaotangPayment(tx) || tx.id === excludeTxId) continue;
    if (normalizePaotangQuotaOwner(tx.paidBy) !== owner) continue;

    const subsidy = getPaotangSubsidyFromTx(tx);
    totalUsed += subsidy;

    if (forDate && tx.date?.seconds) {
      const txDate = new Date(tx.date.seconds * 1000);
      if (toMonthKey(txDate) === monthKey) monthUsed += subsidy;
      if (toDayKey(txDate) === dayKey) dayUsed += subsidy;
    }
  }

  return {
    totalUsed: roundMoney(totalUsed),
    monthUsed: roundMoney(monthUsed),
    dayUsed: roundMoney(dayUsed),
  };
}

export function computePaotangSplitWithQuota(
  total: number,
  usage: PaotangQuotaUsage,
  quotaMode: PaotangQuotaMode = 'self'
): PaotangSplitResult {
  const absTotal = Math.abs(total);
  const { subsidy: idealSubsidy, userPaid: idealUserPaid } =
    computePaotangIdealSplit(absTotal);

  const remainingDay = Math.max(0, PAOTANG_DAILY_GOV_MAX - usage.dayUsed);

  if (quotaMode === 'payer-other') {
    let subsidy = idealSubsidy;
    let capReason: PaotangCapReason | undefined;

    if (subsidy > remainingDay) {
      subsidy = remainingDay;
      capReason = 'daily';
    }

    subsidy = roundMoney(Math.max(0, subsidy));
    const capped = subsidy < idealSubsidy - 0.001;

    return {
      subsidy,
      userPaid: idealUserPaid,
      idealSubsidy,
      capped,
      capReason: capped ? capReason : undefined,
      oweToPayer: idealUserPaid,
      remaining: {
        total: PAOTANG_TOTAL_QUOTA,
        month: PAOTANG_MONTHLY_QUOTA,
        day: roundMoney(remainingDay),
      },
    };
  }

  const remainingTotal = Math.max(0, PAOTANG_TOTAL_QUOTA - usage.totalUsed);
  const remainingMonth = Math.max(0, PAOTANG_MONTHLY_QUOTA - usage.monthUsed);

  let subsidy = idealSubsidy;
  let capReason: PaotangCapReason | undefined;

  if (subsidy > remainingDay) {
    subsidy = remainingDay;
    capReason = 'daily';
  }
  if (subsidy > remainingMonth) {
    subsidy = remainingMonth;
    capReason = 'monthly';
  }
  if (subsidy > remainingTotal) {
    subsidy = remainingTotal;
    capReason = 'total';
  }

  subsidy = roundMoney(Math.max(0, subsidy));
  const userPaid = roundMoney(absTotal - subsidy);
  const capped = subsidy < idealSubsidy - 0.001;

  return {
    subsidy,
    userPaid,
    idealSubsidy,
    capped,
    capReason: capped ? capReason : undefined,
    remaining: {
      total: roundMoney(remainingTotal),
      month: roundMoney(remainingMonth),
      day: roundMoney(remainingDay),
    },
  };
}

/** 40% user share of a Paotang swipe amount */
export function toPaotangEffectivePayerAmount(amount: number): number {
  return computePaotangIdealSplit(amount).userPaid;
}

/** Convert payer rows to cash-out amounts when payment used Paotang */
export function toEffectivePayersForDebt(
  payers: TripExpensePayer[],
  paymentMethod?: PaymentMethod | null
): TripExpensePayer[] {
  if (paymentMethod !== 'paotang') return payers;
  return payers.map((p) => ({
    ...p,
    amount: toPaotangEffectivePayerAmount(p.amount),
  }));
}

/** Cash-flow amount used for display, debt split, and expense totals */
export function getTransactionEffectiveAmount(tx: PaymentFields): number {
  const sign = tx.amount >= 0 ? 1 : -1;

  if (tx.payers?.length && tx.shares?.length) {
    const mePayer = tx.payers.find((p) => p.userId === ME_PERSON_ID);
    const meShare = tx.shares.find((s) => s.userId === ME_PERSON_ID);

    if (tx.paymentMethod === 'paotang') {
      if (mePayer) {
        return sign * toPaotangEffectivePayerAmount(mePayer.amount);
      }
      if (meShare && tx.debtTracking === false) {
        return sign * meShare.amount;
      }
      return 0;
    }

    if (mePayer) return sign * mePayer.amount;
    if (meShare && tx.debtTracking === false) return sign * meShare.amount;
    return 0;
  }

  if (tx.paymentMethod === 'paotang') {
    if (isPaotangPaidByOther(tx.paidBy)) {
      if (tx.debtTracking === false) return 0;
      const userShare =
        tx.paotangUserPaid != null && tx.paotangUserPaid >= 0
          ? tx.paotangUserPaid
          : computePaotangOweToPayer(tx.amount);
      return sign * userShare;
    }
    if (tx.paotangUserPaid != null && tx.paotangUserPaid >= 0) {
      return sign * tx.paotangUserPaid;
    }
    const { userPaid } = computePaotangIdealSplit(tx.amount);
    return sign * userPaid;
  }
  return tx.amount;
}

export function buildPaotangPaymentFields(
  total: number,
  usage: PaotangQuotaUsage,
  paidBy?: string | null
): {
  paymentMethod: PaymentMethod;
  paotangSubsidy: number;
  paotangUserPaid: number;
  paotangIdealSubsidy: number;
  paotangQuotaCapped: boolean;
  paotangCapReason: PaotangCapReason | null;
} {
  const quotaMode = getPaotangQuotaMode(paidBy);
  const split = computePaotangSplitWithQuota(total, usage, quotaMode);
  return {
    paymentMethod: 'paotang',
    paotangSubsidy: split.subsidy,
    paotangUserPaid: split.userPaid,
    paotangIdealSubsidy: split.idealSubsidy,
    paotangQuotaCapped: split.capped,
    paotangCapReason: split.capReason ?? null,
  };
}

export function getPaotangCapReasonLabel(reason?: PaotangCapReason | null): string {
  switch (reason) {
    case 'daily':
      return `โควต้ารายวัน (สูงสุด ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}/วัน)`;
    case 'monthly':
      return `โควต้ารายเดือน (฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()}/เดือน ไม่ยกยอด)`;
    case 'total':
      return `โควต้ารวม (฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} ตลอดโครงการ)`;
    default:
      return 'โควต้าเป๋าตัง';
  }
}
