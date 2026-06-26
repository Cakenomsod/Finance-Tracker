'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { useTransactions } from '@/hooks/use-transactions-context'

interface QuickAddContextValue {
  openQuickAdd: () => void
  openSearch: () => void
}

const QuickAddContext = React.createContext<QuickAddContextValue | null>(null)

export function useQuickAdd() {
  const ctx = React.useContext(QuickAddContext)
  if (!ctx) {
    throw new Error('useQuickAdd must be used within QuickAddProvider')
  }
  return ctx
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { addTransaction } = useTransactions()
  const [isOpen, setIsOpen] = React.useState(false)

  const openQuickAdd = React.useCallback(() => setIsOpen(true), [])
  const openSearch = React.useCallback(() => router.push('/transactions'), [router])

  const value = React.useMemo(
    () => ({ openQuickAdd, openSearch }),
    [openQuickAdd, openSearch]
  )

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            onSubmit={async (data) => {
              await addTransaction(data)
              setIsOpen(false)
            }}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </QuickAddContext.Provider>
  )
}
