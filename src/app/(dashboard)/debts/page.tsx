'use client'

import * as React from 'react'
import {
  Users,
  Plus,
  ArrowRight,
  Check,
  History,
  Wallet,
  MoreHorizontal,
  Send,
  Trash2,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/shared/money-input'
import { Label } from '@/components/ui/label'
import { PaymentSourceSelect } from '@/components/accounts/payment-source-select'
import { MoneyPoolSelect } from '@/components/accounts/money-pool-select'
import { useUserSettings } from '@/hooks/use-user-settings'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useMoneyPools } from '@/hooks/use-money-pools'
import { useLocale } from '@/components/locale-provider'
import { useConfirm } from '@/components/shared/confirm-dialog'
import { ContactSelect } from '@/components/friends/contact-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { amountColorClass, cn } from '@/lib/utils'
import { useDebts } from '@/hooks/use-debts'
import { useTripDebts } from '@/hooks/use-trip-debts'
import { useTripSettlements } from '@/hooks/use-trip-settlements'
import { useTransactions } from '@/hooks/use-transactions'
import { allocateSettlementAcrossTrips, resolveTripMemberKey, isCurrentUserKey } from '@/lib/trip-balance'
import { useAuth } from '@/hooks/use-auth'
import { Debt, Transaction, TripSettlement } from '@/lib/firestore-types'
import { TransactionForm } from '@/components/transactions/transaction-form'
import {
  DateGroupDividerMobile,
  DateGroupDividerRow,
} from '@/components/transactions/date-group-divider'
import { createTripSettlement } from '@/lib/firestore'
import { createDebtSettlementTransaction } from '@/lib/debt-payment'
import {
  findDebtPaymentTransaction,
  findTripBatchDebtPaymentTransaction,
  resolveDebtPaymentDebtId,
  reverseDebtPaymentFromSettlement,
  reverseManualDebtPayment,
} from '@/lib/reverse-debt-payment'
import { Timestamp } from 'firebase/firestore'
import {
  formatTransactionDisplayTime,
  groupItemsByDate,
  toDateFromFirestore,
} from '@/lib/datetime'
import { intlLocale, pick } from '@/lib/i18n'
import type { AppLocale } from '@/lib/locale'

/** Debts carry no currency field; settlements are recorded in THB. */
const DEBT_CURRENCY_SYMBOL = '฿'

interface UIGlobalDebt extends Omit<Debt, 'createdAt'> {
  fromDisplayName?: string
  toDisplayName?: string
  isTripDebt?: boolean
  isTransactionDebt?: boolean
  tripIds?: string[]
  createdAt?: any
}

type DebtSource = 'trip' | 'transaction' | 'manual'

function debtSourceKind(debt: UIGlobalDebt): DebtSource {
  if (debt.isTripDebt) return 'trip'
  if (debt.isTransactionDebt) return 'transaction'
  return 'manual'
}

function debtSourceText(source: DebtSource, locale: AppLocale): string {
  if (source === 'trip') return pick(locale, { th: 'ทริป', en: 'Trip', zh: '行程' })
  if (source === 'transaction') return pick(locale, { th: 'ธุรกรรม', en: 'Transaction', zh: '交易' })
  return pick(locale, { th: 'บันทึกเอง', en: 'Manual', zh: '手动' })
}

function resolveDebtDescription(
  debt: UIGlobalDebt,
  txById: Map<string, Transaction>,
  locale: AppLocale
): string {
  if (debt.description) return debt.description
  for (const txId of debt.relatedTxIds || []) {
    const tx = txById.get(txId)
    if (tx?.description) return tx.description
  }
  if (debt.isTripDebt) {
    const tripCount = debt.tripIds?.length || 1
    return tripCount > 1
      ? pick(locale, {
          th: `ค่าใช้จ่ายรวมจาก ${tripCount} ทริป`,
          en: `Combined expenses from ${tripCount} trips`,
          zh: `来自 ${tripCount} 个行程的合计费用`,
        })
      : pick(locale, { th: 'ค่าใช้จ่ายจากทริป', en: 'Trip expenses', zh: '行程费用' })
  }
  if (debt.relatedTxIds?.length) {
    return pick(locale, {
      th: 'แบ่งค่าใช้จ่ายจากธุรกรรม',
      en: 'Split from a transaction',
      zh: '交易分账',
    })
  }
  return pick(locale, { th: 'หนี้ที่บันทึกเอง', en: 'Manually recorded debt', zh: '手动记录的债务' })
}

function resolveDebtDate(debt: UIGlobalDebt, txById: Map<string, Transaction>): Date | null {
  for (const txId of debt.relatedTxIds || []) {
    const tx = txById.get(txId)
    const txDate = toDateFromFirestore(tx?.date)
    if (txDate) return txDate
  }
  return toDateFromFirestore(debt.createdAt)
}

function resolveSettledDebtDate(
  debt: Debt,
  txById: Map<string, Transaction>
): Date | null {
  const settledDate = toDateFromFirestore(debt.settledAt)
  if (settledDate) return settledDate
  return resolveDebtDate(debt as UIGlobalDebt, txById)
}

interface PaymentHistoryItem {
  id: string
  settlementId?: string
  debtId?: string
  label: string
  person: string
  isReceived: boolean
  amount: number
  date: Date | null
  source: DebtSource
}

function resolveSettlementSource(settlement: TripSettlement): DebtSource {
  if (settlement.tripId) return 'trip'
  return 'manual'
}

function formatDebtAmount(amount: number, options?: { sign?: 'plus' | 'minus' | 'none' }) {
  const sign = options?.sign ?? 'none'
  const prefix = sign === 'plus' ? '+' : sign === 'minus' ? '-' : ''
  return `${prefix}${DEBT_CURRENCY_SYMBOL}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function DebtsSkeleton() {
  const { p } = useLocale()
  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-6"
      aria-busy="true"
      aria-label={p({ th: 'กำลังโหลดหนี้', en: 'Loading debts', zh: '正在加载债务' })}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-2 h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function DebtEmptyState({
  type,
  onAdd,
}: {
  type: 'owe' | 'owed' | 'history'
  onAdd?: () => void
}) {
  const { p } = useLocale()
  const copy =
    type === 'owe'
      ? {
          title: p({ th: 'คุณยังไม่ติดใคร', en: "You don't owe anyone", zh: '你没有欠任何人' }),
          body: p({
            th: 'เมื่อมีค่าใช้จ่ายร่วมกัน หนี้จะโผล่ที่นี่ — หรือบันทึกหนี้เองได้เลย',
            en: 'Shared expenses will show up here — or record a debt yourself.',
            zh: '共同支出产生的债务会显示在这里——也可以手动记录债务。',
          }),
          icon: Send,
        }
      : type === 'owed'
        ? {
            title: p({ th: 'ยังไม่มีใครติดเงินคุณ', en: 'No one owes you', zh: '还没有人欠你钱' }),
            body: p({
              th: 'ยอดที่เพื่อนหรือทริปค้างชำระจะแสดงที่นี่เมื่อมีรายการ',
              en: 'Amounts friends or trips owe you will appear here.',
              zh: '好友或行程欠你的款项会显示在这里。',
            }),
            icon: Wallet,
          }
        : {
            title: p({ th: 'ยังไม่มีประวัติการจ่ายคืน', en: 'No payback history yet', zh: '暂无还款记录' }),
            body: p({
              th: 'เมื่อจ่ายหรือรับเงินคืน รายการจะถูกบันทึกที่นี่',
              en: 'Payments you make or receive will be recorded here.',
              zh: '还款或收款后，记录会保存在这里。',
            }),
            icon: History,
          }
  const Icon = copy.icon

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold text-balance">{copy.title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{copy.body}</p>
      {onAdd && (
        <Button size="sm" className="mt-4 gap-2" onClick={onAdd}>
          <Plus className="size-4" />
          {p({ th: 'บันทึกหนี้', en: 'Record a debt', zh: '记录债务' })}
        </Button>
      )}
    </div>
  )
}

function DebtTable({
  debts,
  type,
  txById,
  onSettle,
  onDelete,
  onViewTransaction,
}: {
  debts: UIGlobalDebt[]
  type: 'owe' | 'owed'
  txById: Map<string, Transaction>
  onSettle: (id: string) => void
  onDelete: (id: string) => void
  onViewTransaction: (txId: string) => void
}) {
  const { p, locale, t } = useLocale()
  const groupedDebts = React.useMemo(
    () => groupItemsByDate(debts, (debt) => resolveDebtDate(debt, txById), intlLocale(locale)),
    [debts, txById, locale]
  )
  const personRole =
    type === 'owe'
      ? p({ th: 'ต้องคืนให้', en: 'Pay back to', zh: '还给' })
      : p({ th: 'รอเก็บจาก', en: 'Collect from', zh: '待收款自' })
  const payBackLabel = p({ th: 'จ่ายคืน', en: 'Pay back', zh: '还款' })
  const receiveLabel = p({ th: 'รับเงิน', en: 'Receive', zh: '收款' })
  const viewTxLabel = p({ th: 'ดูรายละเอียดธุรกรรม', en: 'View transaction', zh: '查看交易详情' })
  const autoFromTripLabel = p({ th: 'สร้างอัตโนมัติจากทริป', en: 'Auto-created from a trip', zh: '由行程自动生成' })
  const autoFromTxLabel = p({
    th: 'สร้างอัตโนมัติจากธุรกรรม',
    en: 'Auto-created from a transaction',
    zh: '由交易自动生成',
  })
  const moreOptionsLabel = (itemLabel: string) =>
    p({
      th: `ตัวเลือกเพิ่มเติมสำหรับ ${itemLabel}`,
      en: `More options for ${itemLabel}`,
      zh: `${itemLabel} 的更多选项`,
    })
  const paidSoFarLabel = (amount: number) =>
    p({
      th: `จ่ายแล้ว ${formatDebtAmount(amount)}`,
      en: `Paid ${formatDebtAmount(amount)}`,
      zh: `已付 ${formatDebtAmount(amount)}`,
    })
  const amountTone = type === 'owe' ? 'text-foreground' : 'text-success'
  const avatarTone =
    type === 'owe' ? 'bg-warning/15 text-foreground' : 'bg-success/15 text-success'

  return (
    <>
      <div className="space-y-3 md:hidden">
        {groupedDebts.map((group) => (
          <div
            key={group.dateKey}
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <DateGroupDividerMobile label={group.label} />
            <div className="divide-y">
              {group.items.map((debt) => {
                const person =
                  type === 'owe'
                    ? debt.toDisplayName || debt.toUserId
                    : debt.fromDisplayName || debt.fromUserId
                const itemLabel = resolveDebtDescription(debt, txById, locale)
                const initials = person.substring(0, 2).toUpperCase()
                const relatedTxId = debt.relatedTxIds?.[0]
                const canViewTx = !!relatedTxId && txById.has(relatedTxId)
                const debtDate = resolveDebtDate(debt, txById)

                return (
                  <div
                    key={debt.id}
                    role={canViewTx ? 'button' : undefined}
                    tabIndex={canViewTx ? 0 : undefined}
                    className={cn(
                      'p-4 transition-colors duration-200 motion-reduce:transition-none',
                      canViewTx &&
                        'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
                    )}
                    onClick={() => {
                      if (canViewTx) onViewTransaction(relatedTxId)
                    }}
                    onKeyDown={(e) => {
                      if (!canViewTx) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onViewTransaction(relatedTxId)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug text-balance">{itemLabel}</p>
                        {debtDate && (
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {formatTransactionDisplayTime(debtDate)}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className={cn('text-[10px] font-medium', avatarTone)}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm text-muted-foreground">
                            {personRole}: <span className="text-foreground">{person}</span>
                          </span>
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs font-normal">
                          {debtSourceText(debtSourceKind(debt), locale)}
                        </Badge>
                        {debt.paidAmount != null && debt.paidAmount > 0 && (
                          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                            {paidSoFarLabel(debt.paidAmount)}
                          </p>
                        )}
                      </div>
                      <p className={cn('shrink-0 text-lg font-semibold tabular-nums', amountTone)}>
                        {formatDebtAmount(debt.amount, {
                          sign: type === 'owe' ? 'minus' : 'plus',
                        })}
                      </p>
                    </div>
                    {debt.status === 'pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 min-h-10 flex-1 transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSettle(debt.id!)
                          }}
                        >
                          {type === 'owe' ? (
                            <>
                              <Send className="mr-1.5 size-3.5" aria-hidden />
                              {payBackLabel}
                            </>
                          ) : (
                            <>
                              <Check className="mr-1.5 size-3.5" aria-hidden />
                              {receiveLabel}
                            </>
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-10 shrink-0"
                              aria-label={moreOptionsLabel(itemLabel)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canViewTx && (
                              <DropdownMenuItem
                                onClick={() => onViewTransaction(relatedTxId!)}
                              >
                                {viewTxLabel}
                              </DropdownMenuItem>
                            )}
                            {debt.isTripDebt || debt.isTransactionDebt ? (
                              <DropdownMenuItem disabled>
                                {debt.isTripDebt ? autoFromTripLabel : autoFromTxLabel}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => onDelete(debt.id!)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Card className="hidden shadow-sm md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{p({ th: 'รายการ', en: 'Item', zh: '项目' })}</TableHead>
                <TableHead className="w-[140px]">{personRole}</TableHead>
                <TableHead className="w-[90px]">{p({ th: 'แหล่ง', en: 'Source', zh: '来源' })}</TableHead>
                <TableHead className="w-[120px] text-right">{t('tx.amount')}</TableHead>
                <TableHead className="w-[140px] text-right">
                  {p({ th: 'การดำเนินการ', en: 'Actions', zh: '操作' })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedDebts.map((group) => (
                <React.Fragment key={group.dateKey}>
                  <DateGroupDividerRow label={group.label} colSpan={5} />
                  {group.items.map((debt) => {
                    const person =
                      type === 'owe'
                        ? debt.toDisplayName || debt.toUserId
                        : debt.fromDisplayName || debt.fromUserId
                    const itemLabel = resolveDebtDescription(debt, txById, locale)
                    const initials = person.substring(0, 2).toUpperCase()
                    const relatedTxId = debt.relatedTxIds?.[0]
                    const canViewTx = !!relatedTxId && txById.has(relatedTxId)
                    const debtDate = resolveDebtDate(debt, txById)

                    return (
                      <TableRow
                        key={debt.id}
                        className={cn(
                          'group transition-colors duration-200 motion-reduce:transition-none',
                          canViewTx && 'cursor-pointer'
                        )}
                        onClick={() => {
                          if (canViewTx) onViewTransaction(relatedTxId)
                        }}
                      >
                        <TableCell>
                          <p
                            className="max-w-[280px] truncate font-medium"
                            title={itemLabel}
                          >
                            {itemLabel}
                          </p>
                          {debtDate && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatTransactionDisplayTime(debtDate)}
                            </p>
                          )}
                          {debt.paidAmount != null && debt.paidAmount > 0 && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {paidSoFarLabel(debt.paidAmount)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback
                                className={cn('text-[10px] font-medium', avatarTone)}
                              >
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{person}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {debtSourceText(debtSourceKind(debt), locale)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-semibold tabular-nums', amountTone)}
                        >
                          {formatDebtAmount(debt.amount, {
                            sign: type === 'owe' ? 'minus' : 'plus',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {debt.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="transition-colors duration-200"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSettle(debt.id!)
                                }}
                              >
                                {type === 'owe' ? (
                                  <>
                                    <Send className="mr-1.5 size-3.5" aria-hidden />
                                    {payBackLabel}
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-1.5 size-3.5" aria-hidden />
                                    {receiveLabel}
                                  </>
                                )}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-9"
                                  aria-label={moreOptionsLabel(itemLabel)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canViewTx && (
                                  <DropdownMenuItem
                                    onClick={() => onViewTransaction(relatedTxId!)}
                                  >
                                    {viewTxLabel}
                                  </DropdownMenuItem>
                                )}
                                {debt.isTripDebt || debt.isTransactionDebt ? (
                                  <DropdownMenuItem disabled>
                                    {debt.isTripDebt ? autoFromTripLabel : autoFromTxLabel}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => onDelete(debt.id!)}
                                  >
                                    <Trash2 className="mr-2 size-4" />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

export default function DebtsPage() {
  const { user } = useAuth()
  const { debts, loading, addDebt, settleDebt, removeDebt } = useDebts()
  const { tripDebts, tripBalanceData, loading: tripLoading } = useTripDebts()
  const { settlements: paymentSettlements, loading: settlementsLoading, removeSettlement } = useTripSettlements()
  const { transactions, editTransaction, removeTransaction } = useTransactions()
  const { accountsEnabled, moneyPoolsEnabled } = useUserSettings()
  const { activeSources, defaultSource } = usePaymentSources()
  const { activePools } = useMoneyPools()
  const { t, p, locale } = useLocale()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const txById = React.useMemo(() => {
    const map = new Map<string, Transaction>()
    transactions.forEach((tx) => {
      if (tx.id) map.set(tx.id, tx)
    })
    return map
  }, [transactions])

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newDebtType, setNewDebtType] = React.useState<'owe' | 'owed'>('owe')
  const [newDebtPerson, setNewDebtPerson] = React.useState('')
  const [newDebtAmount, setNewDebtAmount] = React.useState('')
  const [isAddingDebt, setIsAddingDebt] = React.useState(false)

  const [settleDebtData, setSettleDebtData] = React.useState<UIGlobalDebt | null>(null)
  const [isSettleOpen, setIsSettleOpen] = React.useState(false)
  const [settleAmount, setSettleAmount] = React.useState<string>('')
  const [settleAccountId, setSettleAccountId] = React.useState('')
  const [settleMoneyPoolId, setSettleMoneyPoolId] = React.useState('')
  const [isSettling, setIsSettling] = React.useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = React.useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null)
  const [isTxDetailOpen, setIsTxDetailOpen] = React.useState(false)

  const debtById = React.useMemo(() => {
    const map = new Map<string, Debt>()
    debts.forEach((d) => {
      if (d.id) map.set(d.id, d)
    })
    return map
  }, [debts])

  const paymentHistory = React.useMemo((): PaymentHistoryItem[] => {
    const items: PaymentHistoryItem[] = paymentSettlements.map((settlement) => {
      const isReceived = settlement.toUserId === user?.uid
      const person = isReceived
        ? settlement.fromDisplayName || settlement.fromUserId
        : settlement.toDisplayName || settlement.toUserId

      let label = pick(locale, { th: 'การชำระหนี้', en: 'Debt payment', zh: '债务还款' })
      if (settlement.tripId) {
        label = pick(locale, { th: 'ค่าใช้จ่ายจากทริป', en: 'Trip expenses', zh: '行程费用' })
      } else if (settlement.note?.startsWith('debt:')) {
        const debt = debtById.get(settlement.note.slice(5))
        label = debt
          ? resolveDebtDescription(
              { ...debt, isTransactionDebt: (debt.relatedTxIds?.length ?? 0) > 0 },
              txById,
              locale
            )
          : pick(locale, { th: 'ชำระหนี้', en: 'Debt payment', zh: '债务还款' })
      }

      return {
        id: settlement.id || `${settlement.fromUserId}-${settlement.date?.seconds}`,
        settlementId: settlement.id,
        label,
        person,
        isReceived,
        amount: settlement.amount,
        date: toDateFromFirestore(settlement.date),
        source: resolveSettlementSource(settlement),
      }
    })

    const settledDebts = debts.filter((d) => d.status === 'settled')
    settledDebts.forEach((debt) => {
      const hasSettlement = paymentSettlements.some(
        (s) =>
          s.note === `debt:${debt.id}` ||
          (s.fromUserId === debt.fromUserId &&
            s.toUserId === debt.toUserId &&
            !s.tripId &&
            Math.abs(s.amount - (debt.paidAmount || debt.amount)) < 0.01)
      )
      if (hasSettlement) return

      const isReceived = debt.toUserId === user?.uid
      items.push({
        id: `debt-${debt.id}`,
        debtId: debt.id,
        label: resolveDebtDescription(debt as UIGlobalDebt, txById, locale),
        person: isReceived
          ? debt.fromDisplayName || debt.fromUserId
          : debt.toDisplayName || debt.toUserId,
        isReceived,
        amount: debt.paidAmount || debt.amount,
        date: resolveSettledDebtDate(debt, txById),
        source: (debt.relatedTxIds?.length ?? 0) > 0 ? 'transaction' : 'manual',
      })
    })

    return items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
  }, [paymentSettlements, debts, debtById, user?.uid, txById, locale])

  const groupedPaymentHistory = React.useMemo(
    () => groupItemsByDate(paymentHistory, (item) => item.date, intlLocale(locale)),
    [paymentHistory, locale]
  )

  const settleCashOptions = React.useMemo(
    () => ({
      accountId: accountsEnabled && settleAccountId ? settleAccountId : undefined,
      moneyPoolId: moneyPoolsEnabled && settleMoneyPoolId ? settleMoneyPoolId : undefined,
    }),
    [accountsEnabled, moneyPoolsEnabled, settleAccountId, settleMoneyPoolId]
  )

  if (loading || tripLoading || settlementsLoading) {
    return <DebtsSkeleton />
  }

  // Map manual debts (includes auto-synced transaction debts)
  const manualPending = debts
    .filter((d) => d.status === 'pending')
    .map(
      (d) =>
        ({
          ...d,
          isTransactionDebt: (d.relatedTxIds?.length ?? 0) > 0,
        }) as UIGlobalDebt
    )
  
  // Map trip debts
  const mappedTripDebts: UIGlobalDebt[] = tripDebts.map(td => {
    if (td.amount > 0) {
      // Owed to me
      return {
        id: `trip-debt-${td.personId}`,
        fromUserId: td.personId,
        fromDisplayName: td.personName,
        toUserId: user!.uid,
        amount: td.amount,
        status: 'pending',
        isTripDebt: true,
        tripIds: td.tripIds,
        relatedTxIds: [],
        settledAt: null,
      }
    } else {
      // I owe them
      return {
        id: `trip-debt-${td.personId}`,
        fromUserId: user!.uid,
        toUserId: td.personId,
        toDisplayName: td.personName,
        amount: Math.abs(td.amount),
        status: 'pending',
        isTripDebt: true,
        tripIds: td.tripIds,
        relatedTxIds: [],
        settledAt: null,
      }
    }
  })

  const allPending = [...manualPending, ...mappedTripDebts]

  const youOwe = allPending.filter((d) => d.fromUserId === user?.uid)
  const owedToYou = allPending.filter((d) => d.toUserId === user?.uid)

  const totalOwed = youOwe.reduce((sum, d) => sum + d.amount, 0)
  const totalOwedToYou = owedToYou.reduce((sum, d) => sum + d.amount, 0)
  
  const netBalance = totalOwedToYou - totalOwed

  const byPerson = (() => {
    const map = new Map<string, { name: string; owedToYou: number; youOwe: number }>()
    for (const d of allPending) {
      const iOwe = d.fromUserId === user?.uid
      const name = iOwe ? d.toDisplayName || d.toUserId : d.fromDisplayName || d.fromUserId
      const key = name.trim().toLowerCase()
      const entry = map.get(key) ?? { name, owedToYou: 0, youOwe: 0 }
      if (iOwe) entry.youOwe += d.amount
      else entry.owedToYou += d.amount
      map.set(key, entry)
    }
    return [...map.values()]
      .map((e) => ({ ...e, net: e.owedToYou - e.youOwe }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  })()

  const handleSettleClick = (id: string) => {
    const debt = allPending.find(d => d.id === id)
    if (!debt) return
    setSettleDebtData(debt)
    setSettleAmount(debt.amount.toString())
    setSettleAccountId(defaultSource?.id ?? '')
    setSettleMoneyPoolId('')
    setIsSettleOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settleDebtData || isSettling) return

    const payAmount = parseFloat(settleAmount)
    if (!payAmount || payAmount <= 0) {
      toast.error(p({ th: 'กรุณาระบุจำนวนเงินที่ถูกต้อง', en: 'Enter a valid amount', zh: '请输入有效金额' }))
      return
    }
    if (payAmount > settleDebtData.amount) {
      toast.error(
        p({ th: 'จำนวนเงินเกินยอดคงเหลือ', en: 'Amount exceeds the remaining balance', zh: '金额超过剩余欠款' })
      )
      return
    }

    setIsSettling(true)
    try {
      if (settleDebtData.isTripDebt) {
        const tripIds = settleDebtData.tripIds || []
        const allocations = allocateSettlementAcrossTrips(
          tripIds,
          tripBalanceData.trips,
          tripBalanceData.expenses,
          tripBalanceData.settlements,
          tripBalanceData.legacyTxs,
          settleDebtData.fromUserId,
          settleDebtData.toUserId,
          payAmount,
          user!.uid
        )

        for (const { tripId, amount } of allocations) {
          const trip = tripBalanceData.trips.find((t) => t.id === tripId)
          const members = trip?.members || []
          const fromKey =
            resolveTripMemberKey(settleDebtData.fromUserId, members, user!.uid) ||
            settleDebtData.fromUserId
          const toKey =
            resolveTripMemberKey(settleDebtData.toUserId, members, user!.uid) ||
            settleDebtData.toUserId
          await createTripSettlement({
            userId: user!.uid,
            tripId,
            fromUserId: fromKey,
            fromDisplayName: settleDebtData.fromDisplayName || settleDebtData.fromUserId,
            toUserId: toKey,
            toDisplayName: settleDebtData.toDisplayName || settleDebtData.toUserId,
            amount,
            isPartial: payAmount < settleDebtData.amount - 0.001,
            date: Timestamp.now(),
          })
        }

        const counterpartyName = isCurrentUserKey(settleDebtData.fromUserId, user!.uid)
          ? settleDebtData.toDisplayName || settleDebtData.toUserId
          : settleDebtData.fromDisplayName || settleDebtData.fromUserId

        await createDebtSettlementTransaction(user!.uid, {
          amount: payAmount,
          isPayer: isCurrentUserKey(settleDebtData.fromUserId, user!.uid),
          counterpartyName,
          debtId: settleDebtData.id,
          note: 'trip-debt',
          date: Timestamp.now(),
          accountId: settleCashOptions.accountId,
          moneyPoolId: settleCashOptions.moneyPoolId,
        })
      } else {
        await settleDebt(settleDebtData.id!, payAmount, settleCashOptions)
      }

      const isPartial = payAmount < settleDebtData.amount - 0.001
      toast.success(
        isPartial
          ? p({ th: 'บันทึกการจ่ายบางส่วนแล้ว', en: 'Partial payment recorded', zh: '已记录部分还款' })
          : p({ th: 'ชำระครบแล้ว', en: 'Fully settled', zh: '已全部结清' })
      )
      setIsSettleOpen(false)
      setSettleDebtData(null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : p({ th: 'บันทึกการชำระไม่สำเร็จ', en: "Couldn't record the payment", zh: '还款记录失败' })
      )
    } finally {
      setIsSettling(false)
    }
  }

  const handleViewTransaction = (txId: string) => {
    const tx = txById.get(txId)
    if (!tx) return
    setEditingTransaction(tx)
    setIsTxDetailOpen(true)
  }

  const handleDeleteDebt = async (id: string) => {
    const debt = debtById.get(id)
    const person = debt
      ? debt.fromUserId === user?.uid
        ? debt.toDisplayName || debt.toUserId
        : debt.fromDisplayName || debt.fromUserId
      : ''
    const amountText = debt ? formatDebtAmount(debt.amount) : ''
    const ok = await confirm({
      title: p({ th: 'ลบหนี้รายการนี้?', en: 'Delete this debt?', zh: '删除这笔债务？' }),
      description: debt
        ? p({
            th: `ยอด ${amountText} กับ ${person} จะหายจากยอดรวม ถ้าแค่ได้เงินคืนแล้ว ให้กด "บันทึกการจ่าย" แทน`,
            en: `${amountText} with ${person} will be removed from your totals. If it was simply paid back, record the payment instead.`,
            zh: `与 ${person} 的 ${amountText} 将从总额中移除。如果只是已还款，请改为记录还款。`,
          })
        : undefined,
      destructive: true,
    })
    if (!ok) return
    try {
      await removeDebt(id)
      toast.success(p({ th: 'ลบหนี้แล้ว', en: 'Debt deleted', zh: '债务已删除' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : p({ th: 'ลบไม่สำเร็จ', en: "Couldn't delete", zh: '删除失败' }))
    }
  }

  const handleDeletePayment = async (payment: PaymentHistoryItem) => {
    if (deletingPaymentId) return

    const amountText = formatDebtAmount(payment.amount)
    const ok = await confirm({
      title: p({ th: 'ยกเลิกการจ่ายคืนนี้?', en: 'Undo this payback?', zh: '撤销这笔还款？' }),
      description: p({
        th: `${amountText} กับ ${payment.person} จะกลับไปเป็นยอดค้างอีกครั้ง`,
        en: `${amountText} with ${payment.person} will become outstanding again.`,
        zh: `与 ${payment.person} 的 ${amountText} 将重新变为未结清。`,
      }),
      confirmLabel: p({ th: 'ยกเลิกการจ่าย', en: 'Undo payment', zh: '撤销还款' }),
      destructive: true,
    })
    if (!ok) return

    const paymentDeletedMsg = p({ th: 'ลบการจ่ายคืนแล้ว', en: 'Payback removed', zh: '还款已删除' })
    setDeletingPaymentId(payment.id)
    try {
      if (payment.settlementId) {
        const settlement = paymentSettlements.find((s) => s.id === payment.settlementId)
        if (!settlement) {
          toast.error(p({ th: 'ไม่พบรายการชำระ', en: 'Payment not found', zh: '未找到还款记录' }))
          return
        }

        const linkedTx =
          findDebtPaymentTransaction(transactions, settlement) ??
          findTripBatchDebtPaymentTransaction(transactions, settlement)

        if (linkedTx?.id) {
          await removeTransaction(linkedTx.id)
          toast.success(paymentDeletedMsg)
          return
        }

        if (settlement.note?.startsWith('debt:')) {
          await reverseDebtPaymentFromSettlement(settlement)
          toast.success(paymentDeletedMsg)
          return
        }

        await removeSettlement(settlement.id!)
        toast.success(p({ th: 'ลบรายการชำระแล้ว', en: 'Payment deleted', zh: '还款记录已删除' }))
        return
      }

      if (payment.debtId) {
        const linkedTx = transactions.find((tx) => {
          const debtId = resolveDebtPaymentDebtId(tx)
          if (debtId !== payment.debtId) return false
          return Math.abs(Math.abs(tx.amount) - payment.amount) < 0.01
        })

        if (linkedTx?.id) {
          await removeTransaction(linkedTx.id)
        } else {
          await reverseManualDebtPayment(payment.debtId, payment.amount)
        }
        toast.success(paymentDeletedMsg)
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : p({ th: 'ลบรายการไม่สำเร็จ', en: "Couldn't delete", zh: '删除失败' })
      )
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handleAddDebt = async () => {
    if (!newDebtPerson || !newDebtAmount || isNaN(parseFloat(newDebtAmount))) return

    setIsAddingDebt(true)
    try {
      await addDebt({
        fromUserId: newDebtType === 'owe' ? user!.uid : newDebtPerson,
        toUserId: newDebtType === 'owe' ? newDebtPerson : user!.uid,
        amount: parseFloat(newDebtAmount),
        relatedTxIds: [],
      })
      toast.success(p({ th: 'จดหนี้แล้ว', en: 'Debt recorded', zh: '债务已记录' }))
      setIsAddOpen(false)
      setNewDebtPerson('')
      setNewDebtAmount('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : p({ th: 'บันทึกไม่สำเร็จ', en: "Couldn't save", zh: '保存失败' }))
    } finally {
      setIsAddingDebt(false)
    }
  }

  const paymentDirectionLabel = (isReceived: boolean) =>
    isReceived
      ? p({ th: 'รับจาก', en: 'From', zh: '收自' })
      : p({ th: 'จ่ายให้', en: 'Paid to', zh: '付给' })
  const deletingLabel = p({ th: 'กำลังลบ...', en: 'Deleting…', zh: '删除中…' })

  const settleIsPayer = settleDebtData?.fromUserId === user?.uid
  const settlePerson = settleDebtData
    ? settleIsPayer
      ? settleDebtData.toDisplayName || settleDebtData.toUserId
      : settleDebtData.fromDisplayName || settleDebtData.fromUserId
    : ''
  const canSaveDebt =
    Boolean(newDebtPerson.trim()) &&
    Boolean(newDebtAmount) &&
    !Number.isNaN(parseFloat(newDebtAmount)) &&
    parseFloat(newDebtAmount) > 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {confirmDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t('nav.debts')}</h1>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            {p({
              th: 'ดูชัดว่าใครติดใคร แล้วบันทึกการจ่ายคืนได้ในไม่กี่คลิก',
              en: 'See who owes whom and record paybacks in a few taps',
              zh: '清楚看到谁欠谁，几步记录还款',
            })}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10 w-full gap-2 sm:w-auto"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          {p({ th: 'จดหนี้', en: 'Record a debt', zh: '记录债务' })}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Send className="size-4" aria-hidden />
              {p({ th: 'ฉันต้องจ่ายคืน', en: 'You owe', zh: '我欠别人' })}
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
              {formatDebtAmount(totalOwed)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {p({ th: `${youOwe.length} รายการ`, en: `${youOwe.length} open`, zh: `${youOwe.length} 笔` })}
            </p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none"
          style={{ animationDelay: '40ms' }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4 text-success" aria-hidden />
              {p({ th: 'เพื่อนต้องคืนฉัน', en: 'Owed to you', zh: '别人欠我' })}
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-success sm:text-3xl">
              {formatDebtAmount(totalOwedToYou)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {p({ th: `${owedToYou.length} รายการ`, en: `${owedToYou.length} open`, zh: `${owedToYou.length} 笔` })}
            </p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none"
          style={{ animationDelay: '80ms' }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden />
              {p({ th: 'หักลบแล้ว', en: 'Net balance', zh: '净额' })}
            </div>
            <p
              className={cn(
                'mt-2 text-2xl font-bold tabular-nums sm:text-3xl',
                amountColorClass(netBalance, 'text-foreground')
              )}
            >
              {netBalance >= 0 ? '+' : '-'}
              {formatDebtAmount(Math.abs(netBalance))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {netBalance > 0
                ? p({ th: 'โดยรวมเพื่อนติดคุณ', en: 'Overall, others owe you', zh: '总体别人欠你' })
                : netBalance < 0
                  ? p({ th: 'โดยรวมคุณต้องจ่ายคืน', en: 'Overall, you owe others', zh: '总体你欠别人' })
                  : p({ th: 'เคลียร์หมดแล้ว', en: 'All settled', zh: '已全部结清' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {byPerson.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold tracking-tight">
              {p({ th: 'สรุปรายคน (หักลบแล้ว)', en: 'Per person (netted)', zh: '按人汇总（已抵消）' })}
            </p>
            <ul className="mt-2 divide-y divide-border">
              {byPerson.map((person) => (
                <li key={person.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    {person.owedToYou > 0 && person.youOwe > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p({
                          th: `เขาติดคุณ ${formatDebtAmount(person.owedToYou)} · คุณติดเขา ${formatDebtAmount(person.youOwe)}`,
                          en: `They owe ${formatDebtAmount(person.owedToYou)} · you owe ${formatDebtAmount(person.youOwe)}`,
                          zh: `对方欠 ${formatDebtAmount(person.owedToYou)} · 你欠 ${formatDebtAmount(person.youOwe)}`,
                        })}
                      </p>
                    )}
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      person.net > 0 ? 'text-success' : 'text-foreground'
                    )}
                  >
                    {person.net > 0
                      ? p({
                          th: `ติดคุณ ${formatDebtAmount(person.net)}`,
                          en: `Owes you ${formatDebtAmount(person.net)}`,
                          zh: `欠你 ${formatDebtAmount(person.net)}`,
                        })
                      : person.net < 0
                        ? p({
                            th: `คุณติด ${formatDebtAmount(-person.net)}`,
                            en: `You owe ${formatDebtAmount(-person.net)}`,
                            zh: `你欠 ${formatDebtAmount(-person.net)}`,
                          })
                        : p({ th: 'หักลบแล้วเท่ากัน', en: 'Even', zh: '已抵消' })}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="you-owe" className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="you-owe" className="gap-2 px-3 py-2">
            <Send className="size-4 shrink-0" aria-hidden />
            <span>{p({ th: 'ฉันต้องจ่าย', en: 'You owe', zh: '我欠' })}</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-hidden
            >
              {youOwe.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="owed-to-you" className="gap-2 px-3 py-2">
            <Wallet className="size-4 shrink-0" aria-hidden />
            <span>{p({ th: 'เพื่อนต้องคืน', en: 'Owed to you', zh: '欠我' })}</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-hidden
            >
              {owedToYou.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-3 py-2">
            <History className="size-4 shrink-0" aria-hidden />
            <span>{p({ th: 'ประวัติ', en: 'History', zh: '历史' })}</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-hidden
            >
              {paymentHistory.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="you-owe"
          className="mt-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          {youOwe.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <DebtEmptyState type="owe" onAdd={() => setIsAddOpen(true)} />
              </CardContent>
            </Card>
          ) : (
            <DebtTable
              debts={youOwe}
              type="owe"
              txById={txById}
              onSettle={handleSettleClick}
              onDelete={handleDeleteDebt}
              onViewTransaction={handleViewTransaction}
            />
          )}
        </TabsContent>

        <TabsContent
          value="owed-to-you"
          className="mt-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          {owedToYou.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <DebtEmptyState type="owed" onAdd={() => setIsAddOpen(true)} />
              </CardContent>
            </Card>
          ) : (
            <DebtTable
              debts={owedToYou}
              type="owed"
              txById={txById}
              onSettle={handleSettleClick}
              onDelete={handleDeleteDebt}
              onViewTransaction={handleViewTransaction}
            />
          )}
        </TabsContent>

        <TabsContent
          value="history"
          className="mt-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{p({ th: 'ประวัติการจ่ายคืน', en: 'Settlement history', zh: '结清记录' })}</CardTitle>
              <CardDescription>
                {p({
                  th: 'การจ่ายคืนทั้งหมด รวมทริป ธุรกรรม และหนี้ที่บันทึกเอง',
                  en: 'All paybacks, including trips, transactions, and manual debts',
                  zh: '所有还款记录，包括行程、交易和手动记录的债务',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {paymentHistory.length === 0 ? (
                <DebtEmptyState type="history" />
              ) : (
                <>
                  <div className="divide-y md:hidden">
                    {groupedPaymentHistory.map((group) => (
                      <div key={group.dateKey}>
                        <DateGroupDividerMobile label={group.label} />
                        {group.items.map((payment) => (
                          <div key={payment.id} className="px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-balance break-words">{payment.label}</p>
                                {payment.date && (
                                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                    {formatTransactionDisplayTime(payment.date)}
                                  </p>
                                )}
                                <p className="mt-2 truncate text-sm text-muted-foreground">
                                  {paymentDirectionLabel(payment.isReceived)}{' '}
                                  <span className="text-foreground">{payment.person}</span>
                                </p>
                                <Badge variant="outline" className="mt-2 text-xs font-normal">
                                  {debtSourceText(payment.source, locale)}
                                </Badge>
                              </div>
                              <p
                                className={cn(
                                  'shrink-0 font-semibold tabular-nums',
                                  payment.isReceived ? 'text-success' : 'text-foreground'
                                )}
                              >
                                {formatDebtAmount(payment.amount, {
                                  sign: payment.isReceived ? 'plus' : 'minus',
                                })}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-3 h-10 min-h-10 text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingPaymentId === payment.id}
                              onClick={() => handleDeletePayment(payment)}
                            >
                              <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                              {deletingPaymentId === payment.id
                                ? deletingLabel
                                : p({ th: 'ลบการจ่ายคืน', en: 'Delete payback', zh: '删除还款' })}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">{p({ th: 'รายการ', en: 'Item', zh: '项目' })}</TableHead>
                        <TableHead>{p({ th: 'คู่รายการ', en: 'Counterparty', zh: '对方' })}</TableHead>
                        <TableHead className="w-[90px]">{p({ th: 'แหล่ง', en: 'Source', zh: '来源' })}</TableHead>
                        <TableHead className="pr-6 text-right">{t('tx.amount')}</TableHead>
                        <TableHead className="w-[100px] text-right">
                          {p({ th: 'การดำเนินการ', en: 'Actions', zh: '操作' })}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPaymentHistory.map((group) => (
                        <React.Fragment key={group.dateKey}>
                          <DateGroupDividerRow label={group.label} colSpan={5} />
                          {group.items.map((payment) => (
                            <TableRow
                              key={payment.id}
                              className="transition-colors duration-200 motion-reduce:transition-none"
                            >
                              <TableCell
                                className="max-w-[240px] truncate pl-6 font-medium"
                                title={payment.label}
                              >
                                {payment.label}
                                {payment.date && (
                                  <p className="text-xs font-normal text-muted-foreground tabular-nums">
                                    {formatTransactionDisplayTime(payment.date)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      'flex size-7 items-center justify-center rounded-full',
                                      payment.isReceived
                                        ? 'bg-success/15 text-success'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                    aria-hidden
                                  >
                                    {payment.isReceived ? (
                                      <ArrowRight className="size-3.5 rotate-180" />
                                    ) : (
                                      <ArrowRight className="size-3.5" />
                                    )}
                                  </div>
                                  <span className="min-w-0 truncate">
                                    {paymentDirectionLabel(payment.isReceived)}{' '}
                                    {payment.person}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs font-normal">
                                  {debtSourceText(payment.source, locale)}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'pr-6 text-right font-semibold tabular-nums',
                                  payment.isReceived
                                    ? 'text-success'
                                    : 'text-foreground'
                                )}
                              >
                                {formatDebtAmount(payment.amount, {
                                  sign: payment.isReceived ? 'plus' : 'minus',
                                })}
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                                  disabled={deletingPaymentId === payment.id}
                                  onClick={() => handleDeletePayment(payment)}
                                >
                                  <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                                  {deletingPaymentId === payment.id ? deletingLabel : t('common.delete')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{p({ th: 'จดหนี้', en: 'Record a debt', zh: '记录债务' })}</DialogTitle>
            <DialogDescription>
              {p({
                th: 'สำหรับเงินที่ยืม/ให้ยืมนอกรายการปกติ ถ้าเป็นค่าข้าวที่หารกัน ให้จดเป็นรายการแล้วเปิด "หารกับเพื่อน" แทน',
                en: 'For loans outside normal entries. For shared bills, add an entry and turn on "Split" instead.',
                zh: '用于普通记录之外的借贷。共同账单请添加记录并开启"分摊"',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <p className="text-sm font-medium" id="debt-type-label">
                {p({ th: 'ใครติดใคร', en: 'Who owes whom', zh: '谁欠谁' })}
              </p>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-labelledby="debt-type-label">
                {(['owed', 'owe'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={newDebtType === type ? 'default' : 'outline'}
                    className="h-10"
                    aria-pressed={newDebtType === type}
                    onClick={() => setNewDebtType(type)}
                  >
                    {type === 'owed'
                      ? p({ th: 'เพื่อนติดเงินฉัน', en: 'They owe me', zh: '对方欠我' })
                      : p({ th: 'ฉันติดเงินเพื่อน', en: 'I owe them', zh: '我欠对方' })}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debt-person">{p({ th: 'กับใคร', en: 'With', zh: '对象' })}</Label>
              <ContactSelect
                id="debt-person"
                value={newDebtPerson}
                onChange={setNewDebtPerson}
                includeMe={false}
                allowNone
                noneLabel={p({ th: '— เลือกเพื่อน —', en: '— Choose a person —', zh: '— 选择联系人 —' })}
                allowCreate
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debt-amount">
                {p({
                  th: `จำนวนเงิน (${DEBT_CURRENCY_SYMBOL})`,
                  en: `Amount (${DEBT_CURRENCY_SYMBOL})`,
                  zh: `金额（${DEBT_CURRENCY_SYMBOL}）`,
                })}
              </Label>
              <Input
                id="debt-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                className="tabular-nums"
                value={newDebtAmount}
                onChange={(e) => setNewDebtAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-10" onClick={() => setIsAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="h-10" onClick={handleAddDebt} disabled={!canSaveDebt || isAddingDebt}>
              {isAddingDebt ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTxDetailOpen}
        onOpenChange={(open) => {
          setIsTxDetailOpen(open)
          if (!open) setEditingTransaction(null)
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
              {p({
                th: 'แก้ไขธุรกรรมนี้จะอัปเดตหนี้ที่เกี่ยวข้องโดยอัตโนมัติ',
                en: 'Editing this transaction automatically updates related debts.',
                zh: '编辑此交易会自动更新相关债务。',
              })}
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <TransactionForm
              key={editingTransaction.id}
              initialData={editingTransaction}
              onSubmit={async (data) => {
                await editTransaction(editingTransaction.id!, data)
                setIsTxDetailOpen(false)
                setEditingTransaction(null)
              }}
              onCancel={() => {
                setIsTxDetailOpen(false)
                setEditingTransaction(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSettleOpen}
        onOpenChange={(open) => {
          setIsSettleOpen(open)
          if (!open) {
            setSettleDebtData(null)
            setSettleAccountId('')
            setSettleMoneyPoolId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {settleIsPayer
                ? p({ th: 'จ่ายคืน', en: 'Pay back', zh: '还款' })
                : p({ th: 'รับเงินคืน', en: 'Receive payment', zh: '收款' })}
            </DialogTitle>
            <DialogDescription>
              {settleDebtData && (
                <>
                  {paymentDirectionLabel(!settleIsPayer)}{' '}
                  <span className="font-medium text-foreground">{settlePerson}</span>
                  {' — '}
                  {resolveDebtDescription(settleDebtData, txById, locale)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {settleDebtData && (
            <div className="space-y-4 pt-2">
              <div
                className={cn(
                  'rounded-xl border px-4 py-3',
                  settleIsPayer
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-success/20 bg-success/5'
                )}
              >
                <p className="text-xs text-muted-foreground">
                  {p({ th: 'ยอดคงเหลือ', en: 'Remaining balance', zh: '剩余欠款' })}
                </p>
                <p
                  className={cn(
                    'mt-1 break-all text-xl font-semibold tabular-nums',
                    settleIsPayer ? 'text-foreground' : 'text-success'
                  )}
                >
                  {formatDebtAmount(settleDebtData.amount)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-amount">
                  {p({
                    th: `จำนวนที่จ่าย (${DEBT_CURRENCY_SYMBOL})`,
                    en: `Amount paid (${DEBT_CURRENCY_SYMBOL})`,
                    zh: `支付金额（${DEBT_CURRENCY_SYMBOL}）`,
                  })}
                </Label>
                <MoneyInput
                  id="settle-amount"
                  currencySymbol={DEBT_CURRENCY_SYMBOL}
                  step="0.01"
                  min="0"
                  max={settleDebtData.amount}
                  className="h-12 text-lg font-semibold"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-pretty">
                  {p({ th: 'สามารถจ่ายบางส่วนได้', en: 'Partial payments are allowed.', zh: '可以部分还款。' })}
                  {settleIsPayer && (
                    <span className="mt-1 block">
                      {p({
                        th: 'จะสร้างธุรกรรม "จ่ายหนี้ให้..." ในรายการของคุณโดยอัตโนมัติ',
                        en: 'A "Debt payment to…" transaction will be added to your list automatically.',
                        zh: '系统会自动在你的记录中添加一笔"还款给…"交易。',
                      })}
                    </span>
                  )}
                </p>
              </div>
              {(accountsEnabled || moneyPoolsEnabled) && (
                <div className="space-y-3 rounded-lg border border-dashed p-3">
                  <p className="text-xs text-muted-foreground text-pretty">
                    {settleIsPayer ? t('accounts.settlePayFrom') : t('accounts.settleReceiveTo')}
                  </p>
                  {accountsEnabled && activeSources.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {settleIsPayer ? t('accounts.fromAccount') : t('accounts.toAccount')}
                      </Label>
                      <PaymentSourceSelect
                        sources={activeSources}
                        value={settleAccountId}
                        onChange={setSettleAccountId}
                        allowNone
                      />
                    </div>
                  )}
                  {moneyPoolsEnabled && activePools.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('accounts.selectPool')}</Label>
                      <MoneyPoolSelect
                        pools={activePools}
                        value={settleMoneyPoolId}
                        onChange={setSettleMoneyPoolId}
                        allowNone
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="transition-colors duration-200"
                  onClick={() => setSettleAmount(settleDebtData.amount.toString())}
                >
                  {p({ th: 'จ่ายเต็มจำนวน', en: 'Full amount', zh: '全额' })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="transition-colors duration-200"
                  onClick={() =>
                    setSettleAmount((settleDebtData.amount / 2).toFixed(2))
                  }
                >
                  {p({ th: 'จ่ายครึ่งหนึ่ง', en: 'Half', zh: '一半' })}
                </Button>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsSettleOpen(false)}
                  disabled={isSettling}
                >
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleConfirmSettle} disabled={isSettling}>
                  {isSettling ? t('common.saving') : p({ th: 'ยืนยัน', en: 'Confirm', zh: '确认' })}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
