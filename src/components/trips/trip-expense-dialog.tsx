'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TripExpenseFormV2 } from '@/components/trips/trip-expense-form'
import { Trip, TripExpense } from '@/lib/firestore-types'
import { updateTripExpenseWithTransaction } from '@/lib/sync-expense-transaction'

interface TripExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: TripExpense | null
  trip: Trip | null
  myUserId: string
}

export function TripExpenseDialog({
  open,
  onOpenChange,
  expense,
  trip,
  myUserId,
}: TripExpenseDialogProps) {
  if (!expense || !trip) return null

  const memberObjects = (trip.members || []).map((key) => ({
    key,
    displayName: trip.memberProfiles?.[key]?.displayName || key,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>Trip expense</DialogTitle>
          <DialogDescription>
            Review and edit this trip expense. Saving keeps the linked transaction in sync.
          </DialogDescription>
        </DialogHeader>
        <TripExpenseFormV2
          key={expense.id}
          tripMembers={memberObjects}
          myUserId={myUserId}
          tripDefaults={{
            countryCode: trip.countryCode,
            tripCurrency: trip.tripCurrency,
            homeCurrency: trip.homeCurrency,
            exchangeRate: trip.exchangeRate,
          }}
          initialData={expense}
          tripId={trip.id!}
          onSubmit={async (data) => {
            await updateTripExpenseWithTransaction(
              expense.id!,
              expense.transactionId,
              data,
              {
                immichAssetIds: data.immichAssetIds,
                immichAssetId: data.immichAssetIds?.[0] ?? data.immichAssetId ?? null,
                source: data.source,
              }
            )
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
