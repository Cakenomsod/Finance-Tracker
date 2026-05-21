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

  const tripCurrency = (trip.tripCurrency as TripCurrency) || 'THB'

  const handleParsed = (result: ReceiptParseResult) => {
    setPendingResult(result)
    setReviewOpen(true)
  }

  const openDraftForm = (draft: ReceiptParseResult) => {
    const expenseDraft = receiptParseToTripExpenseDraft(draft, tripMembers, tripCurrency)
    onOpenExpenseForm(expenseDraft, pendingImmichIds.length ? pendingImmichIds : undefined)
    setPendingImmichIds([])
  }

  return (
    <>
      <AiExpenseQuickInput
        tripId={tripId}
        aiTextProvider="gemma"
        showTextProviderSelect={true}
        onParsed={handleParsed}
        onImmichNoteReady={(id) => setPendingImmichIds((p) => [...p, id])}
        pendingImmichCount={pendingImmichIds.length}
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
