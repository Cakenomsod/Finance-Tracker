'use client'

import * as React from 'react'
import { receiptParseToTripExpenseDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { getTripTimeZone } from '@/lib/trip-currency'
import { Trip, TripCurrency, TripExpense } from '@/lib/firestore-types'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'
import { useAuth } from '@/hooks/use-auth'
import {
  AiExpenseQuickInput,
  type AiExpenseQuickInputHandle,
} from '@/components/ai/ai-expense-quick-input'

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

export interface TripAiPanelHandle {
  completeActiveJob: () => void
}

export const TripAiPanel = React.forwardRef<TripAiPanelHandle, TripAiPanelProps>(
  function TripAiPanel({ tripId, trip, tripMembers, onOpenExpenseForm }, ref) {
    const { user } = useAuth()
    const aiInputRef = React.useRef<AiExpenseQuickInputHandle>(null)
    const activeJobIdRef = React.useRef<string | null>(null)

    const [reviewOpen, setReviewOpen] = React.useState(false)
    const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)
    const [pendingImmichIds, setPendingImmichIds] = React.useState<string[]>([])
    const [reviewImmichIds, setReviewImmichIds] = React.useState<string[]>([])

    const tripCurrency = (trip.tripCurrency as TripCurrency) || 'THB'

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
      // FIX: use only the job's own immich IDs — do NOT merge pendingImmichIds here,
      // those are consumed at job-creation time via onConsumePendingImmichIds.
      setReviewImmichIds(immichIds)
      setReviewOpen(true)
    }

    const openDraftForm = (draft: ReceiptParseResult) => {
      const expenseDraft = receiptParseToTripExpenseDraft(
        draft,
        tripMembers,
        tripCurrency,
        getTripTimeZone(trip.countryCode, tripCurrency),
        user?.uid
      )
      // FIX: use only reviewImmichIds — pendingImmichIds already consumed at job creation
      onOpenExpenseForm(expenseDraft, reviewImmichIds.length ? reviewImmichIds : undefined)
      setReviewImmichIds([])
    }

    return (
      <section aria-label="AI expense capture" className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
        <AiExpenseQuickInput
          ref={aiInputRef}
          tripId={tripId}
          storageScope={`trip:${tripId}`}
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
          defaultCurrency={tripCurrency}
          onConfirm={() => pendingResult && openDraftForm(pendingResult)}
        />
      </section>
    )
  }
)
