'use client'

import * as React from 'react'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Transaction, TripExpense } from '@/lib/firestore-types'
import { formatTransactionDisplayTime, toDateFromFirestore } from '@/lib/datetime'
import { formatCurrencySymbol } from '@/lib/trip-currency'
import { cn } from '@/lib/utils'

interface TransactionDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  tripExpense?: TripExpense | null
  onSaveTransaction?: (
    id: string,
    data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>
  ) => Promise<void>
}

function DetailRow({
  label,
  value,
  highlight,
  className,
}: {
  label: string
  value: React.ReactNode
  highlight?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex justify-between gap-4 text-sm', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 text-right',
          highlight && 'font-semibold tabular-nums'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">{children}</p>
  )
}

function TripExpenseDetailView({ expense }: { expense: TripExpense }) {
  const txDate = toDateFromFirestore(expense.date)
  const currency = expense.currency || 'THB'
  const symbol = formatCurrencySymbol(currency)

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <DetailRow label="รายละเอียด" value={expense.description} />
        <DetailRow label="หมวดหมู่" value={expense.category || 'Other'} />
        {txDate && (
          <DetailRow
            label="วันที่"
            value={
              <span className="tabular-nums">
                {formatTransactionDisplayTime(txDate)}
              </span>
            }
          />
        )}
        <DetailRow
          label="ยอดรวม"
          value={`${symbol}${expense.totalAmount.toLocaleString()}`}
          highlight
        />
        {expense.note && <DetailRow label="หมายเหตุ" value={expense.note} />}
        <DetailRow
          label="แบ่งจ่าย"
          value={
            expense.splitMode === 'solo'
              ? 'คนเดียว'
              : expense.splitMode === 'equal'
                ? 'หารเท่ากัน'
                : expense.splitMode === 'item'
                  ? 'ตามรายการ'
                  : 'กำหนดเอง'
          }
        />
      </div>

      {expense.payers.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>ผู้จ่าย</SectionLabel>
          <div className="space-y-1.5">
            {expense.payers.map((payer, index) => (
              <div
                key={`${payer.userId}-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{payer.displayName}</span>
                <span className="ml-2 shrink-0 font-medium tabular-nums">
                  {symbol}{payer.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expense.shares.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>ส่วนแบ่ง</SectionLabel>
          <div className="space-y-1.5">
            {expense.shares.map((share, index) => (
              <div
                key={`${share.userId}-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{share.displayName}</span>
                <span className="ml-2 shrink-0 font-medium tabular-nums">
                  {symbol}{share.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expense.items && expense.items.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>รายการสินค้า ({expense.items.length})</SectionLabel>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {expense.items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Receipt className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                </div>
                <span className="ml-2 shrink-0 font-semibold tabular-nums">
                  {symbol}{(item.price + (item.tax || 0)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full" asChild>
        <Link href={`/trips/${expense.tripId}`}>ดูในทริป</Link>
      </Button>
    </div>
  )
}

export function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
  tripExpense,
  onSaveTransaction,
}: TransactionDetailDialogProps) {
  const isLegacy = !!transaction
  const isTripExpense = !!tripExpense

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>รายละเอียดธุรกรรม</DialogTitle>
          <DialogDescription>
            {isLegacy
              ? 'แก้ไขธุรกรรมนี้จะอัปเดตข้อมูลที่เกี่ยวข้องโดยอัตโนมัติ'
              : isTripExpense
                ? 'รายจ่ายจากทริป — แก้ไขได้ที่หน้าทริป'
                : ''}
          </DialogDescription>
        </DialogHeader>

        {isLegacy && transaction && onSaveTransaction ? (
          <TransactionForm
            key={transaction.id}
            initialData={transaction}
            onSubmit={async (data) => {
              await onSaveTransaction(transaction.id!, data)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : isTripExpense && tripExpense ? (
          <div className="space-y-3">
            <Badge variant="outline" className="text-[10px]">
              รายจ่ายทริป
            </Badge>
            <TripExpenseDetailView expense={tripExpense} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
