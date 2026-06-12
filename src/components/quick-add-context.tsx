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
import { useTransactions } from '@/hooks/use-transactions'

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
  const { transactions, addTransaction } = useTransactions()
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            existingTransactions={transactions}
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
