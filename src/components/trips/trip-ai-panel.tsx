'use client'

import * as React from 'react'
import { receiptParseToTripExpenseDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Trip, TripCurrency, TripExpense } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import { AiExpenseQuickInput } from '@/components/ai/ai-expense-quick-input'

interface Member {
  key: string
  displayName: string
}

export interface TripAiPanelProps {
  tripId: string
  trip: Trip
  tripMembers: Member[]
  onOpenExpenseForm: (
    draft: Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'>,
    immichAssetIds?: string[] | null
  ) => void
}

export function TripAiPanel({
  tripId,
  trip,
  tripMembers,
  onOpenExpenseForm,
}: TripAiPanelProps) {
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)
  const [pendingImmichIds, setPendingImmichIds] = React.useState<string[]>([])
  const [reviewImmichIds, setReviewImmichIds] = React.useState<string[]>([])

  const tripCurrency = (trip.tripCurrency as TripCurrency) || 'THB'

  const handleReview = (result: ReceiptParseResult, immichIds: string[]) => {
    setPendingResult(result)
    setReviewImmichIds(immichIds.length ? immichIds : pendingImmichIds)
    setReviewOpen(true)
  }

  const openDraftForm = (draft: ReceiptParseResult) => {
    const expenseDraft = receiptParseToTripExpenseDraft(draft, tripMembers, tripCurrency)
    const ids = reviewImmichIds.length ? reviewImmichIds : pendingImmichIds
    onOpenExpenseForm(expenseDraft, ids.length ? ids : undefined)
    setPendingImmichIds([])
    setReviewImmichIds([])
  }

  return (
    <>
      <AiExpenseQuickInput
        tripId={tripId}
        storageScope={`trip:${tripId}`}
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
        defaultCurrency={tripCurrency}
        onConfirm={() => pendingResult && openDraftForm(pendingResult)}
      />
    </>
  )
}
