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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import {
  formatTransactionDisplayTime,
  groupItemsByDate,
  toDateFromFirestore,
} from '@/lib/datetime'
import { shouldIgnoreRowClick } from '@/lib/row-click'
import type { Transaction, Trip, TripExpense } from '@/lib/firestore-types'
import type { TripCurrencyCode } from '@/lib/tax/countries'
import {
  formatCurrencySymbol,
  formatHomeConversion,
} from '@/lib/trip-currency'

export type TripExpenseListItem = {
  id: string | undefined
  description: string
  amount: number
  category: string
  date: Transaction['date']
  paidBy: string
  splitLabel: string
  isLegacy: boolean
  currency?: Transaction['currency']
  rawTx: Transaction | null
  rawEx: TripExpense | null
}

interface TripExpenseListProps {
  expenses: TripExpenseListItem[]
  trip?: Trip | null
  transactions: Transaction[]
  getDisplayName: (key: string) => string
  expandedReceipts: Record<string, boolean>
  onToggleReceipt: (id: string) => void
  onView: (expense: TripExpenseListItem) => void
  onEdit: (expense: TripExpense) => void
  onDeleteLegacy: (id: string, tx: Transaction | null) => void
  onDeleteExpense: (id: string, expense: TripExpense) => Promise<void>
}

function TripExpenseReceiptBreakdown({
  expense,
  trip,
  exSymbol,
  exCurrency,
  exHomeHint,
  getDisplayName,
}: {
  expense: TripExpenseListItem
  trip?: Trip | null
  exSymbol: string
  exCurrency: TripCurrencyCode
  exHomeHint: string | null
  getDisplayName: (key: string) => string
}) {
  if (!expense.rawEx?.items) return null

  return (
    <div className="mt-3 space-y-2 border-t pt-3 text-xs">
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>รายการสินค้า</span>
        <span>ราคา & ภาษี</span>
      </div>
      <div className="space-y-1.5">
        {expense.rawEx.items.map((item, index) => {
          const itemTotal = (Number(item.price) || 0) + (Number(item.tax) || 0)
          return (
            <div
              key={index}
              className="flex items-center justify-between border-b border-muted/50 py-1 last:border-0"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {item.name || 'สินค้า'}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">คนหาร:</span>
                  <div className="flex gap-0.5">
                    {(item.splitWith || []).map((memberKey) => {
                      const initials = getDisplayName(memberKey)
                        .split(' ')
                        .map((word) => word[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                      return (
                        <span
                          key={memberKey}
                          title={getDisplayName(memberKey)}
                          className="flex size-4 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[8px] font-bold text-primary"
                        >
                          {initials}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right font-medium tabular-nums">
                <span>
                  {exSymbol}
                  {itemTotal.toLocaleString()}
                </span>
                {formatHomeConversion(itemTotal, exCurrency, trip) && (
                  <span className="block text-[9px] font-normal text-muted-foreground">
                    ({formatHomeConversion(itemTotal, exCurrency, trip)})
                  </span>
                )}
                {item.tax != null && item.tax > 0 ? (
                  <span className="block text-[10px] text-muted-foreground tabular-nums">
                    (สินค้า {exSymbol}
                    {(Number(item.price) || 0).toLocaleString()} + ภาษี {exSymbol}
                    {(Number(item.tax) || 0).toLocaleString()})
                  </span>
                ) : (
                  <span className="block text-[10px] text-success">Tax free</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {expense.rawEx.baseAmount !== undefined && (
        <div className="flex flex-wrap justify-between gap-1 border-t pt-1.5 text-[10px] text-muted-foreground">
          <span>
            ราคาสินค้ารวม: {exSymbol}
            {expense.rawEx.baseAmount.toLocaleString()} · ภาษีรวม: {exSymbol}
            {(expense.rawEx.taxAmount || 0).toLocaleString()}
            {expense.rawEx.discount != null && expense.rawEx.discount > 0 && (
              <> · ส่วนลด: {exSymbol}{expense.rawEx.discount.toLocaleString()}</>
            )}
          </span>
          <span className="font-semibold text-foreground">
            ยอดรวมทั้งหมด: {exSymbol}
            {expense.amount.toLocaleString()} {exHomeHint && `(${exHomeHint})`}
          </span>
        </div>
      )}
    </div>
  )
}

export function TripExpenseList({
  expenses,
  trip,
  transactions,
  getDisplayName,
  expandedReceipts,
  onToggleReceipt,
  onView,
  onEdit,
  onDeleteLegacy,
  onDeleteExpense,
}: TripExpenseListProps) {
  const grouped = React.useMemo(
    () =>
      groupItemsByDate(expenses, (expense) => toDateFromFirestore(expense.date)),
    [expenses]
  )

  const renderAmount = (expense: TripExpenseListItem) => {
    const exCurrency = (expense.rawTx?.currency ||
      expense.rawEx?.currency ||
      trip?.tripCurrency ||
      'THB') as TripCurrencyCode
    const exSymbol = formatCurrencySymbol(exCurrency)
    const exHomeHint = formatHomeConversion(expense.amount, exCurrency, trip)

    return (
      <>
        <span className="block font-semibold tabular-nums text-destructive">
          -{exSymbol}
          {expense.amount.toLocaleString()}
        </span>
        {exHomeHint && (
          <span className="block text-[10px] font-normal text-muted-foreground">
            ({exHomeHint})
          </span>
        )}
      </>
    )
  }

  const renderActions = (expense: TripExpenseListItem, className?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-9', className)}
          aria-label={`Actions for ${expense.description}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            if (expense.isLegacy) {
              alert(
                'Legacy transactions cannot be edited directly. Please delete and create a new expense.'
              )
            } else if (expense.rawEx) {
              onEdit(expense.rawEx)
            }
          }}
        >
          <Edit2 className="mr-2 size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={async () => {
            if (expense.isLegacy) {
              const tx = transactions.find((item) => item.id === expense.id)
              onDeleteLegacy(expense.id!, tx ?? null)
            } else if (expense.rawEx) {
              await onDeleteExpense(expense.id!, expense.rawEx)
            }
          }}
        >
          <Trash2 className="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const renderReceiptToggle = (expense: TripExpenseListItem) => {
    if (!expense.rawEx?.items?.length) return null
    const expenseId = expense.id!
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation()
          onToggleReceipt(expenseId)
        }}
        aria-expanded={!!expandedReceipts[expenseId]}
        className="ml-1 h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted"
      >
        {expandedReceipts[expenseId] ? 'Hide items' : 'Show receipt'}
      </Button>
    )
  }

  return (
    <>
      <div className="space-y-4 md:hidden">
        {grouped.map((group) => (
          <section key={group.dateKey} aria-label={group.label}>
            <div className="mb-2 px-0.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {group.label}
              </span>
            </div>
            <div className="divide-y rounded-lg border">
              {group.items.map((expense) => {
                const txDate = toDateFromFirestore(expense.date)
                const exCurrency = (expense.rawTx?.currency ||
                  expense.rawEx?.currency ||
                  trip?.tripCurrency ||
                  'THB') as TripCurrencyCode
                const exSymbol = formatCurrencySymbol(exCurrency)
                const exHomeHint = formatHomeConversion(expense.amount, exCurrency, trip)

                return (
                  <div
                    key={expense.id}
                    role="button"
                    tabIndex={0}
                    className="group cursor-pointer p-4 transition-colors duration-200 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={(event) => {
                      if (shouldIgnoreRowClick(event.target)) return
                      onView(expense)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onView(expense)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium leading-snug">{expense.description}</p>
                          {expense.isLegacy && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              Legacy
                            </Badge>
                          )}
                          {renderReceiptToggle(expense)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {expense.category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {expense.splitLabel}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                          {txDate ? formatTransactionDisplayTime(txDate) : ''} ·{' '}
                          {expense.paidBy || 'Me'}
                        </p>
                        {(expense.rawEx?.note || expense.rawTx?.note) && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {expense.rawEx?.note || expense.rawTx?.note}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">{renderAmount(expense)}</div>
                    </div>
                    <div className="mt-2 flex justify-end">{renderActions(expense)}</div>
                    {expandedReceipts[expense.id!] && (
                      <TripExpenseReceiptBreakdown
                        expense={expense}
                        trip={trip}
                        exSymbol={exSymbol}
                        exCurrency={exCurrency}
                        exHomeHint={exHomeHint}
                        getDisplayName={getDisplayName}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">Time</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[44px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((group) => (
              <React.Fragment key={group.dateKey}>
                <DateGroupDividerRow label={group.label} colSpan={6} />
                {group.items.map((expense) => {
                  const txDate = toDateFromFirestore(expense.date)
                  const exCurrency = (expense.rawTx?.currency ||
                    expense.rawEx?.currency ||
                    trip?.tripCurrency ||
                    'THB') as TripCurrencyCode
                  const exSymbol = formatCurrencySymbol(exCurrency)
                  const exHomeHint = formatHomeConversion(expense.amount, exCurrency, trip)

                  return (
                    <TableRow
                      key={expense.id}
                      className="group cursor-pointer transition-colors duration-200"
                      onClick={(event) => {
                        if (shouldIgnoreRowClick(event.target)) return
                        onView(expense)
                      }}
                    >
                      <TableCell className="text-muted-foreground">
                        {txDate ? (
                          <span className="block text-sm tabular-nums leading-none">
                            {formatTransactionDisplayTime(txDate)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{expense.description}</p>
                            {expense.isLegacy && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                Legacy
                              </Badge>
                            )}
                            {renderReceiptToggle(expense)}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {expense.splitLabel}
                          </p>
                          {(expense.rawEx?.note || expense.rawTx?.note) && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {expense.rawEx?.note || expense.rawTx?.note}
                            </p>
                          )}
                          {expandedReceipts[expense.id!] && (
                            <TripExpenseReceiptBreakdown
                              expense={expense}
                              trip={trip}
                              exSymbol={exSymbol}
                              exCurrency={exCurrency}
                              exHomeHint={exHomeHint}
                              getDisplayName={getDisplayName}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expense.paidBy || 'Me'}
                      </TableCell>
                      <TableCell className="text-right">{renderAmount(expense)}</TableCell>
                      <TableCell>
                        {renderActions(
                          expense,
                          'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
