/**
 * Shared AI Insights generation for:
 * - POST /api/ai/insights/generate (authenticated user)
 * - POST /api/ai/insights/cron (batch cron)
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getUserAiSettings } from '@/lib/api-auth';
import { generateInsightsWithProvider } from '@/lib/ai';
import {
  buildInsightPrompt,
  emptyInsightLlmResult,
  type AiInsightLlmResult,
} from '@/lib/ai/insight-schema';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import {
  buildCategoryBreakdown,
  computeMonthTotals,
  getCountedExpenseThb,
  getCountedIncomeThb,
  getDateFromTx,
  getFinancialHabits,
  mergeTransactions,
  type CombinedTransaction,
} from '@/lib/aggregate-transactions';
import {
  formatMonthKey,
  formatWeekKey,
  formatWeekLabel,
  getCurrentWeekSelection,
  getPreviousWeekSelection,
  getWeekDateRange,
  parseMonthKey,
  parseWeekKey,
  weekRangeIso,
} from '@/lib/insight-periods';
import {
  formatMonthLabel,
  getCurrentMonthSelection,
  getPreviousMonthSelection,
  type MonthSelection,
} from '@/lib/datetime';
import type {
  AiInsightPeriodType,
  AiInsightReport,
  AiInsightStats,
  Transaction,
  TripExpense,
} from '@/lib/firestore-types';

const COMPACT_TX_CAP = 50;
const TRIP_ID_CHUNK = 30;

export interface GenerateInsightReportOptions {
  /** Re-generate even if a ready report already exists. Default false. */
  force?: boolean;
  /** Skip writing intermediate `generating` status. Default false. */
  skipGeneratingStatus?: boolean;
}

export interface GenerateInsightReportResult {
  report: AiInsightReport;
  created: boolean;
  reused: boolean;
}

function insightDocRef(uid: string, periodKey: string) {
  return adminDb().collection('users').doc(uid).collection('ai_insights').doc(periodKey);
}

function getMonthDateRange(sel: MonthSelection): { start: Date; end: Date } {
  const start = new Date(sel.year, sel.month, 1, 0, 0, 0, 0);
  const end = new Date(sel.year, sel.month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function resolvePeriodMeta(
  periodType: AiInsightPeriodType,
  periodKey: string,
  locale = 'en'
): {
  year: number;
  month?: number;
  weekStart?: string;
  weekEnd?: string;
  label: string;
  start: Date;
  end: Date;
  priorStart: Date;
  priorEnd: Date;
} {
  const labelLocale = locale === 'th' || locale.startsWith('th') ? 'th-TH' : 'en-US';

  if (periodType === 'month') {
    const sel = parseMonthKey(periodKey);
    if (!sel) throw new Error(`Invalid month periodKey: ${periodKey}`);
    const { start, end } = getMonthDateRange(sel);
    const prior = getMonthDateRange(getPreviousMonthSelection(sel));
    return {
      year: sel.year,
      month: sel.month + 1,
      label: formatMonthLabel(sel, labelLocale),
      start,
      end,
      priorStart: prior.start,
      priorEnd: prior.end,
    };
  }

  const week = parseWeekKey(periodKey);
  if (!week) throw new Error(`Invalid week periodKey: ${periodKey}`);
  const { start, end } = getWeekDateRange(week);
  const prior = getWeekDateRange(getPreviousWeekSelection(week));
  const { weekStart, weekEnd } = weekRangeIso(week);
  return {
    year: week.year,
    weekStart,
    weekEnd,
    label: formatWeekLabel(week, labelLocale),
    start,
    end,
    priorStart: prior.start,
    priorEnd: prior.end,
  };
}

/**
 * Default period key for cron when `periodKey` is omitted:
 * previous complete ISO week / previous calendar month.
 */
export function resolveCronPeriodKey(
  periodType: AiInsightPeriodType,
  periodKey?: string | null
): string {
  if (periodKey && periodKey.trim()) {
    const key = periodKey.trim();
    if (periodType === 'week' && !parseWeekKey(key)) {
      throw new Error(`Invalid week periodKey: ${key}`);
    }
    if (periodType === 'month' && !parseMonthKey(key)) {
      throw new Error(`Invalid month periodKey: ${key}`);
    }
    return key;
  }

  if (periodType === 'week') {
    return formatWeekKey(getPreviousWeekSelection(getCurrentWeekSelection()));
  }
  return formatMonthKey(getPreviousMonthSelection(getCurrentMonthSelection()));
}

function filterByDateRange(
  txs: CombinedTransaction[],
  start: Date,
  end: Date
): CombinedTransaction[] {
  return txs.filter((tx) => {
    const d = getDateFromTx(tx);
    return d >= start && d <= end;
  });
}

function buildStats(
  current: CombinedTransaction[],
  prior: CombinedTransaction[]
): AiInsightStats {
  const totals = computeMonthTotals(current);
  const priorTotals = computeMonthTotals(prior);
  const categories = buildCategoryBreakdown(current).slice(0, 8);

  let vsPriorExpenseChangePercent: number | null = null;
  if (priorTotals.expenses > 0) {
    vsPriorExpenseChangePercent = Math.round(
      ((totals.expenses - priorTotals.expenses) / priorTotals.expenses) * 100
    );
  } else if (totals.expenses === 0) {
    vsPriorExpenseChangePercent = 0;
  }

  return {
    totalIncome: totals.income,
    totalExpense: totals.expenses,
    net: totals.net,
    transactionCount: current.length,
    topCategories: categories.map((c) => ({
      name: c.name,
      amount: c.value,
      percent: c.percentage,
    })),
    vsPriorExpenseChangePercent,
    savingsRate: totals.income > 0 ? totals.savingsRate : null,
  };
}

function compactTxSample(txs: CombinedTransaction[]) {
  return txs.slice(0, COMPACT_TX_CAP).map((tx) => ({
    date: getDateFromTx(tx).toISOString().slice(0, 10),
    category: tx.category,
    description: (tx.description || '').slice(0, 80),
    expense: Math.round(getCountedExpenseThb(tx)),
    income: Math.round(getCountedIncomeThb(tx)),
  }));
}

async function loadTransactionsInRange(
  uid: string,
  start: Date,
  end: Date
): Promise<Transaction[]> {
  const snap = await adminDb()
    .collection('transactions')
    .where('userId', '==', uid)
    .where('date', '>=', Timestamp.fromDate(start))
    .where('date', '<=', Timestamp.fromDate(end))
    .orderBy('date', 'desc')
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

async function loadTripExpensesInRange(
  uid: string,
  start: Date,
  end: Date
): Promise<TripExpense[]> {
  const db = adminDb();
  const [createdSnap, memberSnap] = await Promise.all([
    db.collection('trips').where('createdBy', '==', uid).get(),
    db.collection('trips').where('members', 'array-contains', uid).get(),
  ]);

  const tripIds = new Set<string>();
  for (const doc of createdSnap.docs) tripIds.add(doc.id);
  for (const doc of memberSnap.docs) tripIds.add(doc.id);

  const ids = Array.from(tripIds);
  if (ids.length === 0) return [];

  const expenses: TripExpense[] = [];
  for (let i = 0; i < ids.length; i += TRIP_ID_CHUNK) {
    const chunk = ids.slice(i, i + TRIP_ID_CHUNK);
    const snap = await db
      .collection('trip_expenses')
      .where('tripId', 'in', chunk)
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .orderBy('date', 'desc')
      .get();

    for (const doc of snap.docs) {
      expenses.push({ id: doc.id, ...doc.data() } as TripExpense);
    }
  }
  return expenses;
}

async function loadCombinedForWindow(
  uid: string,
  start: Date,
  end: Date
): Promise<CombinedTransaction[]> {
  const [transactions, tripExpenses] = await Promise.all([
    loadTransactionsInRange(uid, start, end),
    loadTripExpensesInRange(uid, start, end),
  ]);
  return mergeTransactions(transactions, tripExpenses, uid);
}

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

function docToReport(id: string, data: DocumentData): AiInsightReport {
  return { id, ...data } as AiInsightReport;
}

function emptyStats(): AiInsightStats {
  return {
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    transactionCount: 0,
    topCategories: [],
    vsPriorExpenseChangePercent: null,
    savingsRate: null,
  };
}

/**
 * Generate (or reuse) an AI insight report for one user + period and persist it
 * under `users/{uid}/ai_insights/{periodKey}`.
 */
export async function generateInsightReportForUser(
  uid: string,
  periodType: AiInsightPeriodType,
  periodKey: string,
  options: GenerateInsightReportOptions = {}
): Promise<GenerateInsightReportResult> {
  const force = options.force === true;
  const ref = insightDocRef(uid, periodKey);
  const existing = await ref.get();

  if (existing.exists && !force) {
    const report = docToReport(existing.id, existing.data()!);
    if (report.status === 'ready') {
      return { report, created: false, reused: true };
    }
  }

  const userSnap = await adminDb().collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : undefined;
  const locale = (userData?.locale as string | undefined) || 'en';
  const meta = resolvePeriodMeta(periodType, periodKey, locale);

  if (!options.skipGeneratingStatus) {
    await ref.set(
      stripUndefined({
        id: periodKey,
        userId: uid,
        periodType,
        periodKey,
        year: meta.year,
        month: meta.month,
        weekStart: meta.weekStart,
        weekEnd: meta.weekEnd,
        summary: '',
        highlights: [],
        tips: [],
        anomalies: [],
        stats: emptyStats(),
        status: 'generating' as const,
        errorMessage: null,
        locale,
        generatedAt: existing.exists
          ? (existing.data()?.generatedAt as Timestamp) || Timestamp.now()
          : Timestamp.now(),
        updatedAt: Timestamp.now(),
      }),
      { merge: true }
    );
  }

  try {
    const loadStart = meta.priorStart < meta.start ? meta.priorStart : meta.start;
    const allCombined = await loadCombinedForWindow(uid, loadStart, meta.end);
    const current = filterByDateRange(allCombined, meta.start, meta.end);
    const prior = filterByDateRange(allCombined, meta.priorStart, meta.priorEnd);
    const stats = buildStats(current, prior);

    let llm: AiInsightLlmResult;
    let provider: string | undefined;
    let model: string | undefined;

    if (current.length === 0) {
      llm = emptyInsightLlmResult(locale);
    } else {
      const habits = getFinancialHabits(current);
      const prompt = buildInsightPrompt({
        locale,
        periodType,
        periodKey,
        periodLabel: meta.label,
        statsJson: JSON.stringify({ ...stats, habits }, null, 2),
        compactTxJson: JSON.stringify(compactTxSample(current), null, 2),
      });

      const aiSettings = await getUserAiSettings(uid);
      if (aiSettings.provider === 'gemma' && !getGoogleAiApiKey()) {
        throw new Error('GOOGLE_AI_API_KEY is not configured on the server');
      }

      const generated = await generateInsightsWithProvider(prompt, {
        provider: aiSettings.provider,
        localAiConfig: aiSettings.localAiBaseUrl
          ? { baseUrl: aiSettings.localAiBaseUrl }
          : undefined,
      });
      llm = generated.result;
      provider = generated.provider;
      model = generated.model;
    }

    const now = Timestamp.now();
    const reportPayload: AiInsightReport = {
      id: periodKey,
      userId: uid,
      periodType,
      periodKey,
      year: meta.year,
      month: meta.month,
      weekStart: meta.weekStart,
      weekEnd: meta.weekEnd,
      summary: llm.summary,
      highlights: llm.highlights,
      tips: llm.tips,
      anomalies: llm.anomalies,
      stats,
      status: 'ready',
      errorMessage: null,
      provider,
      model,
      locale,
      generatedAt: now as unknown as AiInsightReport['generatedAt'],
      updatedAt: now as unknown as AiInsightReport['updatedAt'],
    };

    await ref.set(stripUndefined({ ...reportPayload }), { merge: true });
    return { report: reportPayload, created: true, reused: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI Insights] generateInsightReportForUser failed:', message);
    const now = Timestamp.now();
    const failed: AiInsightReport = {
      id: periodKey,
      userId: uid,
      periodType,
      periodKey,
      year: meta.year,
      month: meta.month,
      weekStart: meta.weekStart,
      weekEnd: meta.weekEnd,
      summary: '',
      highlights: [],
      tips: [],
      anomalies: [],
      stats: emptyStats(),
      status: 'failed',
      errorMessage: message,
      locale,
      generatedAt: now as unknown as AiInsightReport['generatedAt'],
      updatedAt: now as unknown as AiInsightReport['updatedAt'],
    };
    await ref.set(stripUndefined({ ...failed }), { merge: true });
    return { report: failed, created: true, reused: false };
  }
}

/** Run async work with a fixed concurrency limit. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
