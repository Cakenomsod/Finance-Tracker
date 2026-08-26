'use client'

import * as React from 'react'
import { receiptParseToTransactionDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Transaction } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import {
  AiExpenseQuickInput,
  type AiExpenseQuickInputHandle,
} from '@/components/ai/ai-expense-quick-input'
import { useUserSettings } from '@/hooks/use-user-settings'
import { isAppCurrency, type AppCurrency } from '@/lib/currency'

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
  const { currency: settingsCurrency } = useUserSettings()
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
    setPendingResult(result)
    setReviewImmichIds(immichIds)
    setReviewOpen(true)
  }

  const openDraftForm = (result: ReceiptParseResult) => {
    const draft = receiptParseToTransactionDraft(result, currency)
    const ids = [...reviewImmichIds]
    onOpenDraftForm(draft, ids.length ? ids : undefined)
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
        onConfirm={() => {
          if (pendingResult) {
            openDraftForm(pendingResult)
          }
        }}
      />
    </>
  )
})
