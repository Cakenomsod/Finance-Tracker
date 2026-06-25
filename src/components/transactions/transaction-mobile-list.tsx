'use client'

import * as React from 'react'
import { Edit2, MoreHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, amountColorClass } from '@/lib/utils'
import { getPaotangCapReasonLabel, PAOTANG_GOV_PERCENT } from '@/lib/transaction-payment'
import { Transaction, Category } from '@/lib/firestore-types'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import {
  formatTransactionDisplayTime,
  groupItemsByDate,
  toDateFromFirestore,
} from '@/lib/datetime'
import { shouldIgnoreRowClick } from '@/lib/row-click'

type CombinedTransaction = {
  id: string | undefined
  description: string
  amount: number
  fullAmount?: number
  category: string
  date: Transaction['date']
  paidBy: string
  isLegacy: boolean
  isPaotang: boolean
  paotangQuotaCapped?: boolean
  paotangCapReason?: Transaction['paotangCapReason']
  rawTx: Transaction | null
  rawEx: { currency?: string } | null
  note?: string
}

interface TransactionMobileListProps {
  transactions: CombinedTransaction[]
  loading: boolean
  categoryByName: Map<string, Category>
  selectedRows: string[]
  onRowSelect: (id: string) => void
  onView: (transaction: CombinedTransaction) => void
  onEdit: (tx: Transaction) => void
  onDelete: (id: string, tx: Transaction | null) => void
}

export function TransactionMobileList({
  transactions,
  loading,
  categoryByName,
  selectedRows,
  onRowSelect,
  onView,
  onEdit,
  onDelete,
}: TransactionMobileListProps) {
  const grouped = React.useMemo(
    () =>
      groupItemsByDate(transactions, (transaction) =>
        toDateFromFirestore(transaction.date)
      ),
    [transactions]
  )

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading transactions...
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No transactions found.
      </div>
    )
  }

  return (
    <div className="space-y-3 md:hidden">
      {grouped.map((group) => (
        <div key={group.dateKey}>
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full">
              <tbody>
                <DateGroupDividerRow label={group.label} colSpan={1} />
              </tbody>
            </table>
            <div className="divide-y">
              {group.items.map((transaction) => {
                const txId = transaction.id!
                const cat = categoryByName.get(transaction.category)
                const txDate = toDateFromFirestore(transaction.date)
                const isJpy =
                  transaction.rawTx?.currency === 'JPY' ||
                  transaction.rawEx?.currency === 'JPY'
                const displayAmount = transaction.amount
                const fullAmount = transaction.fullAmount ?? transaction.amount

                return (
                  <div
                    key={txId}
                    className={cn(
                      'flex cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/30',
                      selectedRows.includes(txId) && 'bg-muted/50'
                    )}
                    onClick={(e) => {
                      if (shouldIgnoreRowClick(e.target)) return
                      onView(transaction)
                    }}
                  >
                    <Checkbox
                      checked={selectedRows.includes(txId)}
                      onCheckedChange={() => onRowSelect(txId)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">
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
                                Trip Expense
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
                          <p
                            className={cn(
                              'font-semibold tabular-nums',
                              amountColorClass(displayAmount)
                            )}
                          >
                            {displayAmount > 0 ? '+' : ''}
                            {isJpy ? '¥' : '฿'}
                            {Math.abs(displayAmount).toLocaleString()}
                          </p>
                          {isJpy && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              ({displayAmount > 0 ? '+' : ''}฿
                              {(Math.abs(displayAmount) * 0.22).toLocaleString()})
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {txDate
                            ? formatTransactionDisplayTime(txDate)
                            : ''}{' '}
                          · {transaction.paidBy || 'Me'}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transaction.isLegacy ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => onEdit(transaction.rawTx!)}
                                >
                                  <Edit2 className="mr-2 size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    onDelete(txId, transaction.rawTx)
                                  }
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem disabled>
                                Go to Trip to edit
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {transaction.note && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          📝 {transaction.note}
                        </p>
                      )}
                      {transaction.isPaotang &&
                        Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            เต็ม ฿{Math.abs(fullAmount).toLocaleString()} · รัฐ{' '}
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
        </div>
      ))}
    </div>
  )
}
