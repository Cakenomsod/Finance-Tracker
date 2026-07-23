import { z } from 'zod';

/** Parse messy AI number values. */
function toAiNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const aiNumberOptional = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  const n = toAiNumber(val);
  return n === undefined ? undefined : n;
}, z.number().optional());

const impactSchema = z.preprocess((val) => {
  if (val == null || val === '') return 'medium';
  const s = String(val).toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}, z.enum(['high', 'medium', 'low']));

const highlightTypeSchema = z.preprocess((val) => {
  if (val == null || val === '') return 'insight';
  const s = String(val).toLowerCase();
  if (s === 'warning' || s === 'alert' || s === 'danger') return 'warning';
  if (s === 'positive' || s === 'good' || s === 'success') return 'positive';
  return 'insight';
}, z.enum(['warning', 'insight', 'positive']));

const difficultySchema = z.preprocess((val) => {
  if (val == null || val === '') return 'Medium';
  const s = String(val).toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'hard') return 'Hard';
  return 'Medium';
}, z.enum(['Easy', 'Medium', 'Hard']));

const severitySchema = z.preprocess((val) => {
  if (val == null || val === '') return 'medium';
  const s = String(val).toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}, z.enum(['high', 'medium', 'low']));

export const aiInsightHighlightSchema = z.object({
  type: highlightTypeSchema,
  title: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  description: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  impact: impactSchema,
  amount: aiNumberOptional,
  change: z.preprocess((v) => {
    if (v == null || v === '') return undefined;
    return String(v);
  }, z.string().optional()),
});

export const aiInsightTipSchema = z.object({
  title: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  description: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  potentialSavings: aiNumberOptional,
  difficulty: difficultySchema,
});

export const aiInsightAnomalySchema = z.object({
  title: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  description: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  severity: severitySchema,
});

function softenInsightPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(obj.highlights)) obj.highlights = [];
  if (!Array.isArray(obj.tips)) obj.tips = [];
  if (!Array.isArray(obj.anomalies)) obj.anomalies = [];
  if (obj.summary == null) obj.summary = '';
  return obj;
}

export const aiInsightLlmSchema = z.preprocess(
  softenInsightPayload,
  z.object({
    summary: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
    highlights: z.array(aiInsightHighlightSchema).max(8),
    tips: z.array(aiInsightTipSchema).max(6),
    anomalies: z.array(aiInsightAnomalySchema).max(6),
  })
);

export type AiInsightLlmResult = z.infer<typeof aiInsightLlmSchema>;

export interface InsightPromptContext {
  locale: string;
  periodType: 'week' | 'month';
  periodKey: string;
  periodLabel: string;
  statsJson: string;
  compactTxJson: string;
}

function languageInstruction(locale: string): string {
  if (locale === 'th' || locale.startsWith('th-')) {
    return 'Write ALL text fields (summary, titles, descriptions, change) in Thai (ภาษาไทย).';
  }
  return 'Write ALL text fields (summary, titles, descriptions, change) in English.';
}

export function buildInsightPrompt(ctx: InsightPromptContext): string {
  return `You are a personal finance analyst for a budgeting app.
Given pre-aggregated spending stats and a compact transaction sample, return ONLY one JSON object — no markdown, no code fences, no explanation.

Required JSON shape:
{
  "summary": string,
  "highlights": [
    {
      "type": "warning" | "insight" | "positive",
      "title": string,
      "description": string,
      "impact": "high" | "medium" | "low",
      "amount": number (optional),
      "change": string (optional, e.g. "+12%" or "-฿500")
    }
  ],
  "tips": [
    {
      "title": string,
      "description": string,
      "potentialSavings": number (optional),
      "difficulty": "Easy" | "Medium" | "Hard"
    }
  ],
  "anomalies": [
    {
      "title": string,
      "description": string,
      "severity": "high" | "medium" | "low"
    }
  ]
}

Rules:
- ${languageInstruction(ctx.locale)}
- Period: ${ctx.periodType} ${ctx.periodKey} (${ctx.periodLabel})
- Base conclusions on the provided stats; do not invent income/expense totals that contradict them
- Prefer 2–5 highlights, 1–3 actionable tips, and 0–3 anomalies
- If data is sparse, keep insights cautious and note limited data in the summary
- amounts and potentialSavings must be plain JSON numbers (THB), not strings
- Do not repeat the same point across highlights and tips

Pre-aggregated stats JSON:
${ctx.statsJson}

Compact transaction sample (capped):
${ctx.compactTxJson}`;
}

export function emptyInsightLlmResult(locale: string): AiInsightLlmResult {
  const isTh = locale === 'th' || locale.startsWith('th-');
  return {
    summary: isTh
      ? 'ข้อมูลในช่วงนี้ยังไม่เพียงพอสำหรับการวิเคราะห์เชิงลึก ลองเพิ่มรายรับรายจ่ายแล้วสร้างอินไซต์อีกครั้ง'
      : 'Not enough activity in this period for a detailed analysis. Add more transactions and generate insights again.',
    highlights: [],
    tips: [],
    anomalies: [],
  };
}
