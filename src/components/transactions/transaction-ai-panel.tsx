'use client'

import * as React from 'react'
import { receiptParseToTransactionDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Transaction } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import { AiExpenseQuickInput } from '@/components/ai/ai-expense-quick-input'

export interface TransactionAiPanelProps {
  currency?: 'THB' | 'JPY'
  onOpenDraftForm: (draft: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => void
}

export function TransactionAiPanel({
  currency = 'THB',
  onOpenDraftForm,
}: TransactionAiPanelProps) {
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)

  const handleParsed = (result: ReceiptParseResult) => {
    setPendingResult(result)
    setReviewOpen(true)
  }

  return (
    <>
      <AiExpenseQuickInput
        aiTextProvider="gemma"
        showTextProviderSelect={true}
        onParsed={handleParsed}
      />

      <AiReceiptReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={pendingResult}
        defaultCurrency={currency}
        onConfirm={() => {
          if (pendingResult) {
            onOpenDraftForm(receiptParseToTransactionDraft(pendingResult, currency))
          }
        }}
      />
    </>
  )
}
