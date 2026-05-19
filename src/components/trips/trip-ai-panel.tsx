'use client'

import * as React from 'react'
import { receiptParseToTripExpenseDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Trip, TripCurrency, TripExpense, AiTextProvider } from '@/lib/firestore-types'
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
  aiTextProvider: AiTextProvider
  onOpenExpenseForm: (
    draft: Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'>,
    immichAssetId?: string | null
  ) => void
}

export function TripAiPanel({
  tripId,
  trip,
  tripMembers,
  aiTextProvider,
  onOpenExpenseForm,
}: TripAiPanelProps) {
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)
  const [pendingImmichId, setPendingImmichId] = React.useState<string | null>(null)

  const tripCurrency = (trip.tripCurrency as TripCurrency) || 'THB'

  const handleParsed = (result: ReceiptParseResult) => {
    setPendingResult(result)
    setReviewOpen(true)
  }

  const openDraftForm = (draft: ReceiptParseResult) => {
    const expenseDraft = receiptParseToTripExpenseDraft(draft, tripMembers, tripCurrency)
    onOpenExpenseForm(expenseDraft, pendingImmichId)
    setPendingImmichId(null)
  }

  return (
    <>
      <AiExpenseQuickInput
        tripId={tripId}
        aiTextProvider={aiTextProvider}
        onParsed={handleParsed}
        onImmichNoteReady={setPendingImmichId}
        pendingImmichId={pendingImmichId}
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
