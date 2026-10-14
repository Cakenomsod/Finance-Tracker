'use client'

import * as React from 'react'
import { receiptParseToTransactionDraft, type TransactionDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Transaction } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import {
  AiExpenseQuickInput,
  type AiExpenseQuickInputHandle,
} from '@/components/ai/ai-expense-quick-input'
import { useUserSettings } from '@/hooks/use-user-settings'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { isAppCurrency, type AppCurrency } from '@/lib/currency'
import { resolveDraftTarget } from '@/lib/ai/draft-resolve'

export interface TransactionAiPanelProps {
  currency?: AppCurrency | string
  onOpenDraftForm: (
    draft: Omit<Transaction, 'id' | 'createdAt' | 'userId'>,
    immichAssetIds?: string[]
  ) => void
}

export interface TransactionAiPanelHandle {
  completeActiveJob: () => void
}

export const TransactionAiPanel = React.forwardRef<
  TransactionAiPanelHandle,
  TransactionAiPanelProps
>(function TransactionAiPanel({ currency: currencyProp, onOpenDraftForm }, ref) {
  const { currency: settingsCurrency, accountsEnabled } = useUserSettings()
  const { activeSources } = usePaymentSources()
  const currency: AppCurrency = isAppCurrency(currencyProp)
    ? currencyProp
    : isAppCurrency(settingsCurrency)
      ? settingsCurrency
      : 'THB'
  const aiInputRef = React.useRef<AiExpenseQuickInputHandle>(null)
  const activeJobIdRef = React.useRef<string | null>(null)

  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)
  const [pendingImmichIds, setPendingImmichIds] = React.useState<string[]>([])
  const [reviewImmichIds, setReviewImmichIds] = React.useState<string[]>([])

  React.useImperativeHandle(ref, () => ({
    completeActiveJob: () => {
      if (activeJobIdRef.current) {
        aiInputRef.current?.completeJob(activeJobIdRef.current)
        activeJobIdRef.current = null
      }
    },
  }))

  const handleReview = (
    result: ReceiptParseResult,
    immichIds: string[],
    jobId: string
  ) => {
    activeJobIdRef.current = jobId
    // A single-line draft is fully visible in the form itself; only itemized receipts need the summary step.
    if (!result.items?.length) {
      openDraftForm(result, immichIds)
      return
    }
    setPendingResult(result)
    setReviewImmichIds(immichIds)
    setReviewOpen(true)
  }

  const target = React.useMemo(
    () =>
      pendingResult
        ? resolveDraftTarget(pendingResult, activeSources, currency, {
            fallbackToDefaultAccount: accountsEnabled,
          })
        : null,
    [pendingResult, activeSources, currency, accountsEnabled]
  )

  function openDraftForm(result: ReceiptParseResult, immichIds: string[] = reviewImmichIds) {
    const draft: TransactionDraft = receiptParseToTransactionDraft(result, currency)
    const resolvedTarget =
      result === pendingResult && target
        ? target
        : resolveDraftTarget(result, activeSources, currency, {
            fallbackToDefaultAccount: accountsEnabled,
          })
    const { accountId, transferToAccountId, currency: resolvedCurrency, currencySource } =
      resolvedTarget

    const { accountHint: _a, transferToAccountHint: _b, currency: _c, ...rest } = draft
    const resolved: Omit<Transaction, 'id' | 'createdAt' | 'userId'> = {
      ...rest,
      // Only pin a currency the user wrote; otherwise the form follows the chosen account.
      ...(currencySource === 'parsed' ? { currency: resolvedCurrency } : {}),
      ...(accountId ? { accountId } : {}),
      ...(transferToAccountId ? { transferToAccountId } : {}),
    }

    const ids = [...immichIds]
    onOpenDraftForm(resolved, ids.length ? ids : undefined)
    setReviewImmichIds([])
  }

  return (
    <>
      <AiExpenseQuickInput
        ref={aiInputRef}
        storageScope="transactions"
        pendingImmichIds={pendingImmichIds}
        onImmichNoteReady={(id) => setPendingImmichIds((p) => [...new Set([...p, id])])}
        onConsumePendingImmichIds={(ids) =>
          setPendingImmichIds((p) => p.filter((id) => !ids.includes(id)))
        }
        onReview={handleReview}
      />

      <AiReceiptReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={pendingResult}
        defaultCurrency={currency}
        target={
          target
            ? {
                currency: target.currency,
                currencySource: target.currencySource,
                accountName: activeSources.find((s) => s.id === target.accountId)?.name,
                transferToName: activeSources.find((s) => s.id === target.transferToAccountId)
                  ?.name,
              }
            : undefined
        }
        onConfirm={() => {
          if (pendingResult) {
            openDraftForm(pendingResult)
          }
        }}
      />
    </>
  )
})
