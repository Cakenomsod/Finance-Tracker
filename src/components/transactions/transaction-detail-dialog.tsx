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
import { useLocale } from '@/components/locale-provider'
import { categoryLabel } from '@/lib/default-categories'

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
  const { p, locale } = useLocale()
  const txDate = toDateFromFirestore(expense.date)
  const currency = expense.currency || 'THB'
  const symbol = formatCurrencySymbol(currency)
  const payers = expense.payers ?? []
  const shares = expense.shares ?? []
  const total = Number(expense.totalAmount) || 0

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <DetailRow
          label={p({ th: 'รายละเอียด', en: 'Details', zh: '详情' })}
          value={expense.description}
        />
        <DetailRow
          label={p({ th: 'หมวดหมู่', en: 'Category', zh: '分类' })}
          value={categoryLabel(expense.category || 'Other', locale)}
        />
        {txDate && (
          <DetailRow
            label={p({ th: 'วันที่', en: 'Date', zh: '日期' })}
            value={
              <span className="tabular-nums">
                {formatTransactionDisplayTime(txDate)}
              </span>
            }
          />
        )}
        <DetailRow
          label={p({ th: 'ยอดรวม', en: 'Total', zh: '总额' })}
          value={`${symbol}${total.toLocaleString()}`}
          highlight
        />
        {expense.note && (
          <DetailRow label={p({ th: 'หมายเหตุ', en: 'Note', zh: '备注' })} value={expense.note} />
        )}
        <DetailRow
          label={p({ th: 'แบ่งจ่าย', en: 'Split', zh: '分账方式' })}
          value={
            expense.splitMode === 'solo'
              ? p({ th: 'คนเดียว', en: 'Just me', zh: '仅自己' })
              : expense.splitMode === 'equal'
                ? p({ th: 'หารเท่ากัน', en: 'Split equally', zh: '平均分摊' })
                : expense.splitMode === 'item'
                  ? p({ th: 'ตามรายการ', en: 'By item', zh: '按项目' })
                  : p({ th: 'กำหนดเอง', en: 'Custom', zh: '自定义' })
          }
        />
      </div>

      {payers.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{p({ th: 'ผู้จ่าย', en: 'Paid by', zh: '付款人' })}</SectionLabel>
          <div className="space-y-1.5">
            {payers.map((payer, index) => (
              <div
                key={`${payer.userId}-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{payer.displayName}</span>
                <span className="ml-2 shrink-0 font-medium tabular-nums">
                  {symbol}{(Number(payer.amount) || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shares.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{p({ th: 'ส่วนแบ่ง', en: 'Shares', zh: '分摊' })}</SectionLabel>
          <div className="space-y-1.5">
            {shares.map((share, index) => (
              <div
                key={`${share.userId}-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{share.displayName}</span>
                <span className="ml-2 shrink-0 font-medium tabular-nums">
                  {symbol}{(Number(share.amount) || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expense.items && expense.items.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>
            {p({ th: 'รายการสินค้า', en: 'Items', zh: '商品' })} ({expense.items.length})
          </SectionLabel>
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
                    <p className="text-xs text-muted-foreground">{categoryLabel(item.category, locale)}</p>
                  </div>
                </div>
                <span className="ml-2 shrink-0 font-semibold tabular-nums">
                  {symbol}{((Number(item.price) || 0) + (Number(item.tax) || 0)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full" asChild>
        <Link href={`/trips/${expense.tripId}`}>
          {p({ th: 'ดูในทริป', en: 'View in trip', zh: '在行程中查看' })}
        </Link>
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
  const { p } = useLocale()
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
          <DialogTitle>
            {p({ th: 'รายละเอียดธุรกรรม', en: 'Transaction details', zh: '交易详情' })}
          </DialogTitle>
          <DialogDescription>
            {isLegacy
              ? p({
                  th: 'แก้ไขธุรกรรมนี้จะอัปเดตข้อมูลที่เกี่ยวข้องโดยอัตโนมัติ',
                  en: 'Editing this transaction updates related data automatically',
                  zh: '编辑此交易会自动更新相关数据',
                })
              : isTripExpense
                ? p({
                    th: 'รายจ่ายจากทริป — แก้ไขได้ที่หน้าทริป',
                    en: 'Trip expense — edit it on the trip page',
                    zh: '行程支出 — 请在行程页面编辑',
                  })
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
              {p({ th: 'รายจ่ายทริป', en: 'Trip expense', zh: '行程支出' })}
            </Badge>
            <TripExpenseDetailView expense={tripExpense} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
