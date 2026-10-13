import type { AppCurrency } from '@/lib/currency'

type CurrencyRule = {
  code: AppCurrency
  /** Matched anywhere (Thai has no word boundaries; symbols are unambiguous). */
  words: string[]
  /** Latin tokens matched on word boundaries only. */
  latin: string[]
}

/**
 * Ordered most-specific first: "ดอลลาร์สิงคโปร์" must win over "ดอลลาร์",
 * "HK$" over "$", "หยวน" over "¥".
 */
const CURRENCY_RULES: CurrencyRule[] = [
  { code: 'USD', words: ['us$'], latin: [] },
  { code: 'SGD', words: ['ดอลลาร์สิงคโปร์', 'สิงคโปร์ดอลลาร์', 'ดอลสิงคโปร์', 's$'], latin: ['sgd'] },
  { code: 'HKD', words: ['ดอลลาร์ฮ่องกง', 'ฮ่องกงดอลลาร์', 'hk$'], latin: ['hkd'] },
  { code: 'TWD', words: ['ดอลลาร์ไต้หวัน', 'ไต้หวันดอลลาร์', 'nt$'], latin: ['twd', 'ntd'] },
  { code: 'AUD', words: ['ดอลลาร์ออสเตรเลีย', 'ดอลลาร์ออส', 'a$'], latin: ['aud'] },
  { code: 'CAD', words: ['ดอลลาร์แคนาดา', 'c$'], latin: ['cad'] },
  { code: 'NZD', words: ['ดอลลาร์นิวซีแลนด์', 'nz$'], latin: ['nzd'] },
  { code: 'CNY', words: ['หยวน', '元', '人民币'], latin: ['cny', 'rmb', 'yuan'] },
  { code: 'JPY', words: ['เยน', '円', '¥'], latin: ['jpy', 'yen'] },
  { code: 'KRW', words: ['วอน', '₩'], latin: ['krw', 'won'] },
  { code: 'EUR', words: ['ยูโร', '€'], latin: ['eur', 'euro', 'euros'] },
  { code: 'GBP', words: ['ปอนด์', '£'], latin: ['gbp', 'pound', 'pounds'] },
  { code: 'INR', words: ['รูปี', '₹'], latin: ['inr', 'rupee', 'rupees'] },
  { code: 'CHF', words: ['ฟรังก์'], latin: ['chf', 'franc', 'francs'] },
  { code: 'AED', words: ['ดีแรห์ม', 'เดอร์แฮม', 'ดิรฮัม'], latin: ['aed', 'dirham', 'dirhams'] },
  { code: 'QAR', words: ['ริยาลกาตาร์'], latin: ['qar'] },
  { code: 'SAR', words: ['ริยาล'], latin: ['sar', 'riyal', 'riyals'] },
  // NOK is intentionally absent: "nok" in Thai notes is almost always Nok Air.
  { code: 'SEK', words: [], latin: ['sek'] },
  { code: 'DKK', words: [], latin: ['dkk'] },
  { code: 'USD', words: ['ดอลลาร์', 'ดอลล่าร์', 'ดอลล่า', 'ดอล', '$'], latin: ['usd', 'dollar', 'dollars', 'bucks'] },
  { code: 'THB', words: ['บาท', '฿'], latin: ['thb', 'baht'] },
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "50บ" / "50 บ." — the bare Thai บ only counts right after a number. */
const BARE_BAHT_RE = /\d\s*บ(?![ก-๙])\.?/

type CurrencyHit = { code: AppCurrency; start: number; end: number }

function findCurrencyHits(text: string): CurrencyHit[] {
  const lower = text.toLowerCase()
  const taken: Array<[number, number]> = []
  const hits: CurrencyHit[] = []

  const overlaps = (start: number, end: number) =>
    taken.some(([s, e]) => start < e && end > s)

  const push = (code: AppCurrency, start: number, end: number) => {
    if (overlaps(start, end)) return
    taken.push([start, end])
    hits.push({ code, start, end })
  }

  for (const rule of CURRENCY_RULES) {
    for (const word of rule.words) {
      let from = 0
      const needle = word.toLowerCase()
      while (true) {
        const idx = lower.indexOf(needle, from)
        if (idx === -1) break
        push(rule.code, idx, idx + needle.length)
        from = idx + needle.length
      }
    }
    for (const token of rule.latin) {
      const re = new RegExp(`(?<![a-z])${escapeRe(token)}(?![a-z])`, 'g')
      for (const m of lower.matchAll(re)) {
        const idx = m.index ?? 0
        push(rule.code, idx, idx + token.length)
      }
    }
  }

  const bare = lower.match(BARE_BAHT_RE)
  if (bare?.index !== undefined) {
    const start = bare.index + bare[0].indexOf('บ')
    push('THB', start, start + 1)
  }

  return hits.sort((a, b) => a.start - b.start)
}

function isNextToAmount(text: string, hit: CurrencyHit): boolean {
  const before = text.slice(Math.max(0, hit.start - 12), hit.start)
  const after = text.slice(hit.end, hit.end + 12)
  return /\d[\d,.]*\s*$/.test(before) || /^\s*\d/.test(after)
}

/**
 * Currency the user explicitly wrote in this text (symbols, ISO codes, Thai or
 * English words). Returns undefined when nothing — or conflicting currencies —
 * are mentioned, so callers can fall back to the account / default currency.
 */
export function extractCurrencyFromText(text: string): AppCurrency | undefined {
  if (!text?.trim()) return undefined
  const hits = findCurrencyHits(text)
  if (hits.length === 0) return undefined

  const distinct = new Set(hits.map((h) => h.code))
  if (distinct.size === 1) return hits[0].code

  const nearAmount = new Set(hits.filter((h) => isNextToAmount(text, h)).map((h) => h.code))
  if (nearAmount.size === 1) return [...nearAmount][0]
  return undefined
}

/** True when the text mentions any currency at all (even ambiguous mixes). */
export function mentionsAnyCurrency(text: string): boolean {
  return findCurrencyHits(text ?? '').length > 0
}

/** Remove currency tokens so name/amount heuristics and account matching see clean text. */
export function stripCurrencyTokens(text: string): string {
  const hits = findCurrencyHits(text)
  if (hits.length === 0) return text
  let out = ''
  let cursor = 0
  for (const hit of hits) {
    out += text.slice(cursor, hit.start) + ' '
    cursor = hit.end
  }
  out += text.slice(cursor)
  return out.replace(/\s+/g, ' ').trim()
}
