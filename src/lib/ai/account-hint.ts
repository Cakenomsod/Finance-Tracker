import type { PaymentSource } from '@/lib/firestore-types'
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { splitExpenseTextIntoSegments } from '@/lib/ai/expense-text-split'
import { THAI_BANKS } from '@/lib/thai-banks'

export interface ExtractedAccountHints {
  accountHint?: string
  transferToAccountHint?: string
  /** When true, prefer treating as transfer between own accounts */
  suggestsTransfer?: boolean
}

type AliasRule = {
  label: string
  keys: string[]
  bankCode?: string
  cash?: boolean
}

/** Spoken aliases → canonical label used for matching payment sources */
const ACCOUNT_ALIAS_RULES: AliasRule[] = [
  { label: 'เงินสด', keys: ['เงินสด', 'cash'], cash: true },
  {
    label: 'SCB',
    keys: ['scb', 'เอสซีบี', 'ไทยพาณิชย์', 'พาณิชย์'],
    bankCode: 'SCB',
  },
  {
    label: 'Kplus',
    keys: ['kplus', 'k+', 'k bank', 'kbank', 'กสิกร', 'กสิกรไทย'],
    bankCode: 'KBANK',
  },
  {
    label: 'กรุงไทย',
    keys: ['กรุงไทย', 'ktb', 'krungthai'],
    bankCode: 'KTB',
  },
  {
    label: 'กรุงเทพ',
    keys: ['กรุงเทพ', 'bbl', 'bangkok bank'],
    bankCode: 'BBL',
  },
  {
    label: 'กรุงศรี',
    keys: ['กรุงศรี', 'bay', 'krungsri'],
    bankCode: 'BAY',
  },
  {
    label: 'ทหารไทยธนชาต',
    keys: ['ttb', 'ทหารไทย', 'ธนชาต'],
    bankCode: 'TTB',
  },
  {
    label: 'ออมสิน',
    keys: ['ออมสิน', 'gsb'],
    bankCode: 'GSB',
  },
  {
    label: 'TrueMoney',
    keys: ['truemoney', 'ทรูมันนี่', 'true money'],
  },
]

function normalizeHint(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

function matchAliasLabel(token: string): string | undefined {
  const n = normalizeHint(token)
  if (!n) return undefined
  for (const rule of ACCOUNT_ALIAS_RULES) {
    if (rule.keys.some((k) => n === k || n.includes(k) || k.includes(n))) {
      return rule.label
    }
  }
  // bare bank code
  const bank = THAI_BANKS.find((b) => b.code.toLowerCase() === n)
  if (bank) return bank.code
  return undefined
}

/** Pull a known account token from free text near a keyword */
function findAccountTokenAfter(text: string, keywordRe: RegExp): string | undefined {
  const m = text.match(keywordRe)
  if (!m) return undefined
  const rest = text.slice((m.index ?? 0) + m[0].length).trim()
  // Take first 1–3 tokens until amount/time/noise
  const chunk = rest.split(/\s+/).slice(0, 3).join(' ')
  const candidates = [
    chunk,
    rest.split(/\s+/)[0] ?? '',
    ...ACCOUNT_ALIAS_RULES.flatMap((r) => r.keys).filter((k) => normalizeHint(rest).includes(k)),
  ]
  for (const c of candidates) {
    const label = matchAliasLabel(c)
    if (label) return label
  }
  // Scan aliases anywhere in rest
  const restNorm = normalizeHint(rest)
  for (const rule of ACCOUNT_ALIAS_RULES) {
    if (rule.keys.some((k) => restNorm.includes(k))) return rule.label
  }
  return undefined
}

function findTrailingAccount(text: string): string | undefined {
  const n = normalizeHint(text)
  // Prefer longer keys first
  const keys = ACCOUNT_ALIAS_RULES.flatMap((r) =>
    r.keys.map((k) => ({ k, label: r.label }))
  ).sort((a, b) => b.k.length - a.k.length)

  for (const { k, label } of keys) {
    // token at end or preceded by space
    if (n.endsWith(k) || n.includes(` ${k}`)) return label
  }
  return undefined
}

/** Bank/wallet token next to an amount, e.g. "Kplus 200" or "200 Kplus". */
function findAccountNearAmount(text: string): string | undefined {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  for (let i = 0; i < tokens.length; i++) {
    const label = matchAliasLabel(tokens[i])
    if (!label) continue
    const next = tokens[i + 1] ?? ''
    const prev = tokens[i - 1] ?? ''
    if (/^\d/.test(next) || /^\d/.test(prev)) return label
  }
  return undefined
}

function parseAmountFromLine(line: string): number | undefined {
  const withoutTime = line
    .replace(/\d{1,2}[.:]\d{2}/g, ' ')
    .replace(/ตอน\s*/gi, ' ')
  const m = withoutTime.match(
    /(?:^|[^\d.])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(?:บาท|บ|฿|baht))?/i
  )
  if (!m) return undefined
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function findBestMatchingLineIndex(
  draft: ReceiptParseResult,
  lines: string[],
  used: Set<number>
): number {
  const target = Math.abs(draft.totalAmount)
  let bestIdx = -1
  let bestScore = 0

  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue
    const line = lines[i]
    let score = 0

    const lineAmount = parseAmountFromLine(line)
    if (lineAmount !== undefined && Math.abs(lineAmount - target) < 0.01) score += 60

    const desc = draft.description?.trim().toLowerCase()
    if (desc && desc.length >= 2) {
      const lineNorm = normalizeHint(line)
      if (lineNorm.includes(desc) || desc.split(/\s+/).some((w) => w.length >= 2 && lineNorm.includes(w))) {
        score += 25
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  return bestScore > 0 ? bestIdx : -1
}

/**
 * Deterministic account hint extraction from a single journal line.
 * Complements (and overrides empty) AI accountHint fields.
 */
export function extractAccountHintsFromLine(line: string): ExtractedAccountHints {
  const text = line.trim().replace(/ไป/g, ' ไป ').replace(/\s+/g, ' ')
  if (!text) return {}

  // Explicit transfer pairs first
  const fromTo =
    text.match(/โอนจาก\s+(.+?)\s+ไป\s+(\S+)/i) ||
    text.match(/โอนเงินออก\s+(\S+)\s+.*?ไป\s+(\S+)/i)
  if (fromTo) {
    const fromLabel = matchAliasLabel(fromTo[1]) || matchAliasLabel(fromTo[1].split(/\s+/)[0] ?? '')
    const toLabel = matchAliasLabel(fromTo[2])
    if (fromLabel || toLabel) {
      return {
        ...(fromLabel ? { accountHint: fromLabel } : {}),
        ...(toLabel ? { transferToAccountHint: toLabel } : {}),
        suggestsTransfer: true,
      }
    }
  }

  const from = findAccountTokenAfter(text, /จาก\s*/i)
  const toViaKhao =
    findAccountTokenAfter(text, /โอนเข้า\s*/i) ||
    findAccountTokenAfter(text, /เข้า\s*/i)
  const toViaPai = findAccountTokenAfter(text, /ไป\s*/i)
  const outSource =
    findAccountTokenAfter(text, /โอน(?:เงิน)?ออก\s*/i) ||
    findAccountTokenAfter(text, /โอนเงินออก\s*/i)
  const incomeTo =
    findAccountTokenAfter(text, /เงินเข้า\s*/i) ||
    findAccountTokenAfter(text, /โอนเข้า\s*/i)
  const trailing = findTrailingAccount(text)
  const nearAmount = findAccountNearAmount(text)

  const isTransferPhrase =
    /โอนจาก|โอน(?:เงิน)?ออก/.test(text) &&
    !/โอนให้|ให้ลูกค้า|ให้เบล|จ่ายให้/i.test(text)

  const isIncomePhrase =
    /เงินเข้า|โอน(?:เงิน)?เข้า|ลูกค้าโอน|ได้รับ/.test(text) &&
    !/โอน(?:เงิน)?ออก|โอนจาก/.test(text)

  let accountHint: string | undefined
  let transferToAccountHint: string | undefined
  let suggestsTransfer = false

  if (isTransferPhrase) {
    suggestsTransfer = true
    accountHint = outSource || from || nearAmount || trailing
    transferToAccountHint = toViaPai || toViaKhao
  } else if (isIncomePhrase) {
    accountHint = incomeTo || toViaKhao || nearAmount || trailing || from
  } else {
    accountHint = from || outSource || nearAmount || trailing || undefined
  }

  if (!accountHint && trailing) accountHint = trailing
  if (!accountHint && nearAmount) accountHint = nearAmount

  return {
    ...(accountHint ? { accountHint } : {}),
    ...(transferToAccountHint ? { transferToAccountHint } : {}),
    ...(suggestsTransfer ? { suggestsTransfer: true } : {}),
  }
}

function scoreSource(source: PaymentSource, hint: string): number {
  const n = normalizeHint(hint)
  const name = normalizeHint(source.name)
  let score = 0

  const rule = ACCOUNT_ALIAS_RULES.find((r) => normalizeHint(r.label) === n)
  if (rule?.cash && source.type === 'cash') return 100
  if (rule?.bankCode && source.bankCode === rule.bankCode) score += 80

  if (name === n) score += 90
  if (name.includes(n) || n.includes(name)) score += 50

  for (const r of ACCOUNT_ALIAS_RULES) {
    if (normalizeHint(r.label) !== n && !r.keys.includes(n)) continue
    if (r.cash && source.type === 'cash') score += 70
    if (r.bankCode && source.bankCode === r.bankCode) score += 70
    if (r.keys.some((k) => name.includes(k))) score += 40
  }

  // Direct bank code hint
  if (source.bankCode && source.bankCode.toLowerCase() === n) score += 85

  return score
}

/** Resolve a spoken hint to a payment source id */
export function resolveAccountHint(
  hint: string | undefined | null,
  sources: PaymentSource[]
): string | undefined {
  if (!hint?.trim() || sources.length === 0) return undefined
  const active = sources.filter((s) => !s.archived)
  let best: PaymentSource | undefined
  let bestScore = 0
  for (const s of active) {
    const score = scoreSource(s, hint)
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return bestScore >= 40 && best?.id ? best.id : undefined
}

export function mergeExtractedHints(
  ai: { accountHint?: string; transferToAccountHint?: string; txType?: string },
  extracted: ExtractedAccountHints
): {
  accountHint?: string
  transferToAccountHint?: string
  txType?: 'income' | 'expense' | 'transfer'
} {
  const accountHint = extracted.accountHint || ai.accountHint
  const transferToAccountHint = extracted.transferToAccountHint || ai.transferToAccountHint
  let txType = ai.txType as 'income' | 'expense' | 'transfer' | undefined
  if (extracted.suggestsTransfer && transferToAccountHint) {
    txType = 'transfer'
  }
  return {
    ...(accountHint ? { accountHint } : {}),
    ...(transferToAccountHint ? { transferToAccountHint } : {}),
    ...(txType ? { txType } : {}),
  }
}

/**
 * Map account hints per draft from the matching source line.
 * Prevents the first bank in a multi-line paste from being applied to every draft.
 */
export function applyAccountHintsToDrafts(
  drafts: ReceiptParseResult[],
  text: string,
  timeZone = 'Asia/Bangkok'
): ReceiptParseResult[] {
  if (drafts.length === 0) return drafts

  const segments = splitExpenseTextIntoSegments(text, timeZone)
  const lines = segments.map((s) => s.text)

  if (drafts.length === 1) {
    const line = lines[0] ?? text.trim()
    const extracted = extractAccountHintsFromLine(line)
    return drafts.map((draft) => ({
      ...draft,
      ...mergeExtractedHints(draft, extracted),
    }))
  }

  const stripAiAccounts = (draft: ReceiptParseResult) => ({
    ...draft,
    accountHint: undefined,
    transferToAccountHint: undefined,
  })

  if (lines.length === drafts.length) {
    return drafts.map((draft, i) => {
      const extracted = extractAccountHintsFromLine(lines[i])
      return {
        ...draft,
        ...mergeExtractedHints(stripAiAccounts(draft), extracted),
        items: undefined,
      }
    })
  }

  const used = new Set<number>()
  return drafts.map((draft) => {
    const idx = findBestMatchingLineIndex(draft, lines, used)
    const line = idx >= 0 ? lines[idx] : undefined
    if (idx >= 0) used.add(idx)
    const extracted = line ? extractAccountHintsFromLine(line) : {}
    return {
      ...draft,
      ...mergeExtractedHints(stripAiAccounts(draft), extracted),
      items: undefined,
    }
  })
}
