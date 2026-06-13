'use client'

import * as React from 'react'
import { receiptParseToTransactionDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Transaction } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import { AiExpenseQuickInput } from '@/components/ai/ai-expense-quick-input'

export interface TransactionAiPanelProps {
  currency?: 'THB' | 'JPY'
  onOpenDraftForm: (
    draft: Omit<Transaction, 'id' | 'createdAt' | 'userId'>,
    immichAssetIds?: string[]
  ) => void
}

export function TransactionAiPanel({
  currency = 'THB',
  onOpenDraftForm,
}: TransactionAiPanelProps) {
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)
  const [pendingImmichIds, setPendingImmichIds] = React.useState<string[]>([])
  const [reviewImmichIds, setReviewImmichIds] = React.useState<string[]>([])

  const handleReview = (result: ReceiptParseResult, immichIds: string[]) => {
    setPendingResult(result)
    setReviewImmichIds(immichIds.length ? immichIds : pendingImmichIds)
    setReviewOpen(true)
  }

  const openDraftForm = (result: ReceiptParseResult) => {
    const draft = receiptParseToTransactionDraft(result, currency)
    const ids = reviewImmichIds.length ? reviewImmichIds : pendingImmichIds
    onOpenDraftForm(draft, ids.length ? ids : undefined)
    setPendingImmichIds([])
    setReviewImmichIds([])
  }

  return (
    <>
      <AiExpenseQuickInput
        storageScope="transactions"
        aiTextProvider="gemma"
        showTextProviderSelect={true}
        pendingImmichIds={pendingImmichIds}
        onImmichNoteReady={(id) => setPendingImmichIds((p) => [...new Set([...p, id])])}
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
}
