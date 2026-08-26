'use client'

import * as React from 'react'
import { Edit2, MoreHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, amountColorClass } from '@/lib/utils'
import { getPaotangCapReasonLabel, PAOTANG_GOV_PERCENT } from '@/lib/transaction-payment'
import { Transaction, Category, TripExpense } from '@/lib/firestore-types'
import { DateGroupDividerMobile } from '@/components/transactions/date-group-divider'
import { TransactionEmptyState } from '@/components/transactions/transaction-empty-state'
import { TransactionMobileListSkeleton } from '@/components/transactions/transaction-list-skeleton'
import {
  formatTransactionDisplayTime,
  groupItemsByDate,
  toDateFromFirestore,
} from '@/lib/datetime'
import { shouldIgnoreRowClick } from '@/lib/row-click'
import { MoneyAmount } from '@/components/money-amount'
import { STATIC_FALLBACK_RATES } from '@/lib/currency'

type CombinedTransaction = {
  id: string | undefined
  description: string
  amount: number
  amountThb?: number
  fullAmount?: number
  category: string
  date: Transaction['date']
  paidBy: string
  isLegacy: boolean
  isPaotang: boolean
  paotangQuotaCapped?: boolean
  paotangCapReason?: Transaction['paotangCapReason']
  rawTx: Transaction | null
  rawEx: TripExpense | null
  note?: string
  isTripDebtPending?: boolean
}

interface TransactionMobileListProps {
  transactions: CombinedTransaction[]
  loading: boolean
  categoryByName: Map<string, Category>
  hasAnyData: boolean
  hasActiveFilters: boolean
  showLoadOlderHint: boolean
  emptyVariant?: 'no-data' | 'no-results' | 'filtered-load-older' | 'no-month-data'
  /** User's current preference currency (ISO 4217). Used for secondary converted display. */
  preferenceCurrency?: string
  /** Live FX rates map (USD = 1 base). Falls back to static rates when absent. */
  rates?: Record<string, number>
  onView: (transaction: CombinedTransaction) => void
  onEdit: (tx: Transaction) => void
  onDelete: (id: string, tx: Transaction | null) => void
  onAddClick: () => void
  onClearFilters: () => void
}

function paidByLabel(paidBy: string | undefined) {
  if (!paidBy || paidBy === 'Me') return 'ฉัน'
  return paidBy
}

export function TransactionMobileList({
  transactions,
  loading,
  categoryByName,
  hasAnyData,
  hasActiveFilters,
  showLoadOlderHint,
  emptyVariant: emptyVariantProp,
  preferenceCurrency = 'THB',
  rates,
  onView,
  onEdit,
  onDelete,
  onAddClick,
  onClearFilters,
}: TransactionMobileListProps) {
  const effectiveRates = rates ?? (STATIC_FALLBACK_RATES as Record<string, number>)
  const grouped = React.useMemo(
    () =>
      groupItemsByDate(transactions, (transaction) =>
        toDateFromFirestore(transaction.date)
      ),
    [transactions]
  )

  if (loading) {
    return <TransactionMobileListSkeleton />
  }

  if (transactions.length === 0) {
    const emptyVariant =
      emptyVariantProp ??
      (!hasAnyData
        ? 'no-data'
        : showLoadOlderHint
          ? 'filtered-load-older'
          : 'no-results')

    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm md:hidden">
        <TransactionEmptyState
          variant={emptyVariant}
          onAddClick={onAddClick}
          onClearFilters={hasActiveFilters ? onClearFilters : undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 md:hidden">
      {grouped.map((group) => (
        <div key={group.dateKey} className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <DateGroupDividerMobile label={group.label} />
          <div className="divide-y divide-border">
            {group.items.map((transaction) => {
              const txId = transaction.id!
              const cat = categoryByName.get(transaction.category)
              const txDate = toDateFromFirestore(transaction.date)
              const recordedCurrency =
                transaction.rawTx?.currency ??
                transaction.rawEx?.currency ??
                'THB'
              const displayAmount = transaction.amount
              const fullAmount = transaction.fullAmount ?? transaction.amount

              return (
                <div
                  key={txId}
                  className="flex cursor-pointer gap-3 px-3 py-3 transition-colors duration-200 hover:bg-muted/30 active:bg-muted/50 focus-within:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  onClick={(e) => {
                    if (shouldIgnoreRowClick(e.target)) return
                    onView(transaction)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {transaction.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {transaction.isPaotang && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-chart-2/40 text-chart-2"
                            >
                              เป๋าตัง
                            </Badge>
                          )}
                          {!transaction.isLegacy && (
                            <Badge variant="outline" className="text-[10px]">
                              {transaction.isTripDebtPending
                                ? 'ค้างจ่ายทริป'
                                : 'รายจ่ายทริป'}
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal"
                            style={
                              cat?.color
                                ? {
                                    backgroundColor: `${cat.color}20`,
                                    color: cat.color,
                                  }
                                : undefined
                            }
                          >
                            {cat?.icon ? `${cat.icon} ` : ''}
                            {transaction.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <MoneyAmount
                          amount={displayAmount}
                          currency={recordedCurrency}
                          preferenceCurrency={preferenceCurrency}
                          rates={effectiveRates}
                          showSign
                          forcePreference={!!transaction.rawEx}
                          className={cn(
                            'text-sm font-semibold',
                            transaction.isTripDebtPending
                              ? 'text-muted-foreground'
                              : amountColorClass(displayAmount)
                          )}
                        />
                        {transaction.isTripDebtPending && (
                          <p className="text-[10px] text-muted-foreground">
                            ยังไม่นับในรายจ่าย
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate tabular-nums">
                        {txDate ? formatTransactionDisplayTime(txDate) : ''}
                        {' · '}
                        {paidByLabel(transaction.paidBy)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label={`เมนูสำหรับ ${transaction.description}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {transaction.isLegacy ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => onEdit(transaction.rawTx!)}
                              >
                                <Edit2 className="mr-2 size-4" aria-hidden />
                                แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  onDelete(txId, transaction.rawTx)
                                }
                              >
                                <Trash2 className="mr-2 size-4" aria-hidden />
                                ลบ
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem disabled>
                              ไปที่หน้าทริปเพื่อแก้ไข
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {transaction.note && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {transaction.note}
                      </p>
                    )}
                    {transaction.isPaotang &&
                      Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          เต็ม {recordedCurrency === 'JPY' ? '¥' : '฿'}{Math.abs(fullAmount).toLocaleString()} · รัฐ{' '}
                          {PAOTANG_GOV_PERCENT}% (ตามโควต้า)
                        </p>
                      )}
                    {transaction.isPaotang && transaction.paotangQuotaCapped && (
                      <p className="text-[10px] text-warning">
                        โควต้าจำกัด —{' '}
                        {getPaotangCapReasonLabel(transaction.paotangCapReason)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
