import { isAppCurrency, type AppCurrency } from '@/lib/currency'
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { resolveAccountHint, type AiAccount } from '@/lib/ai/account-hint'

export type DraftCurrencySource = 'parsed' | 'account' | 'default'

export interface ResolvedDraftTarget {
  accountId?: string
  transferToAccountId?: string
  currency: AppCurrency
  /** Why this currency was chosen — surfaced in review UI and LINE replies. */
  currencySource: DraftCurrencySource
}

function defaultAccountId(sources: AiAccount[]): string | undefined {
  const active = sources.filter((s) => !s.archived && s.id)
  return (active.find((s) => s.isDefault) ?? active[0])?.id
}

/**
 * Pick account(s) and currency for one parsed draft.
 * Currency priority: written in the text / on the receipt → the chosen
 * account's own currency → the user's preferred currency.
 */
export function resolveDraftTarget(
  draft: Pick<ReceiptParseResult, 'currency' | 'accountHint' | 'transferToAccountHint' | 'txType'>,
  sources: AiAccount[],
  defaultCurrency: string | undefined,
  opts?: { fallbackToDefaultAccount?: boolean }
): ResolvedDraftTarget {
  let accountId = resolveAccountHint(draft.accountHint, sources)
  const transferToAccountId =
    draft.txType === 'transfer'
      ? resolveAccountHint(draft.transferToAccountHint, sources)
      : undefined

  if (!accountId && opts?.fallbackToDefaultAccount) {
    accountId = defaultAccountId(sources)
  }

  const account = accountId ? sources.find((s) => s.id === accountId) : undefined
  const fallback: AppCurrency = isAppCurrency(defaultCurrency) ? defaultCurrency : 'THB'

  if (isAppCurrency(draft.currency)) {
    return { accountId, transferToAccountId, currency: draft.currency, currencySource: 'parsed' }
  }
  if (isAppCurrency(account?.currency)) {
    return { accountId, transferToAccountId, currency: account.currency, currencySource: 'account' }
  }
  return { accountId, transferToAccountId, currency: fallback, currencySource: 'default' }
}
