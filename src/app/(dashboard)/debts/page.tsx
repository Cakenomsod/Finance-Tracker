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
import { Label } from '@/components/ui/label'
import { PaymentSourceSelect } from '@/components/accounts/payment-source-select'
import { MoneyPoolSelect } from '@/components/accounts/money-pool-select'
import { useUserSettings } from '@/hooks/use-user-settings'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useMoneyPools } from '@/hooks/use-money-pools'
import { useLocale } from '@/components/locale-provider'
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
import { allocateSettlementAcrossTrips } from '@/lib/trip-balance'
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

interface UIGlobalDebt extends Omit<Debt, 'createdAt'> {
  fromDisplayName?: string
  toDisplayName?: string
  isTripDebt?: boolean
  isTransactionDebt?: boolean
  tripIds?: string[]
  createdAt?: any
}

function debtSourceLabel(debt: UIGlobalDebt): string {
  if (debt.isTripDebt) return 'ทริป'
  if (debt.isTransactionDebt) return 'ธุรกรรม'
  return 'บันทึกเอง'
}

function resolveDebtDescription(debt: UIGlobalDebt, txById: Map<string, Transaction>): string {
  if (debt.description) return debt.description
  for (const txId of debt.relatedTxIds || []) {
    const tx = txById.get(txId)
    if (tx?.description) return tx.description
  }
  if (debt.isTripDebt) {
    const tripCount = debt.tripIds?.length || 1
    return tripCount > 1 ? `ค่าใช้จ่ายรวมจาก ${tripCount} ทริป` : 'ค่าใช้จ่ายจากทริป'
  }
  if (debt.relatedTxIds?.length) return 'แบ่งค่าใช้จ่ายจากธุรกรรม'
  return 'หนี้ที่บันทึกเอง'
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
  source: 'ทริป' | 'ธุรกรรม' | 'บันทึกเอง'
}

function resolveSettlementSource(settlement: TripSettlement): PaymentHistoryItem['source'] {
  if (settlement.tripId) return 'ทริป'
  if (settlement.note?.startsWith('debt:')) return 'บันทึกเอง'
  return 'บันทึกเอง'
}

function formatDebtAmount(amount: number, options?: { sign?: 'plus' | 'minus' | 'none' }) {
  const sign = options?.sign ?? 'none'
  const prefix = sign === 'plus' ? '+' : sign === 'minus' ? '-' : ''
  return `${prefix}฿${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function DebtsSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" aria-busy="true" aria-label="กำลังโหลดหนี้">
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
  const copy =
    type === 'owe'
      ? {
          title: 'คุณยังไม่ติดใคร',
          body: 'เมื่อมีค่าใช้จ่ายร่วมกัน หนี้จะโผล่ที่นี่ — หรือบันทึกหนี้เองได้เลย',
          icon: Send,
        }
      : type === 'owed'
        ? {
            title: 'ยังไม่มีใครติดเงินคุณ',
            body: 'ยอดที่เพื่อนหรือทริปค้างชำระจะแสดงที่นี่เมื่อมีรายการ',
            icon: Wallet,
          }
        : {
            title: 'ยังไม่มีประวัติการจ่ายคืน',
            body: 'เมื่อจ่ายหรือรับเงินคืน รายการจะถูกบันทึกที่นี่',
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
          บันทึกหนี้
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
  const groupedDebts = React.useMemo(
    () => groupItemsByDate(debts, (debt) => resolveDebtDate(debt, txById)),
    [debts, txById]
  )
  const personRole = type === 'owe' ? 'เจ้าหนี้' : 'ลูกหนี้'
  const amountTone = type === 'owe' ? 'text-destructive' : 'text-success'
  const avatarTone =
    type === 'owe' ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'

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
                const itemLabel = resolveDebtDescription(debt, txById)
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
                          {debtSourceLabel(debt)}
                        </Badge>
                        {debt.paidAmount != null && debt.paidAmount > 0 && (
                          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                            จ่ายแล้ว {formatDebtAmount(debt.paidAmount)}
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
                              จ่ายคืน
                            </>
                          ) : (
                            <>
                              <Check className="mr-1.5 size-3.5" aria-hidden />
                              รับเงิน
                            </>
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-10 shrink-0"
                              aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${itemLabel}`}
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
                                ดูรายละเอียดธุรกรรม
                              </DropdownMenuItem>
                            )}
                            {debt.isTripDebt || debt.isTransactionDebt ? (
                              <DropdownMenuItem disabled>
                                {debt.isTripDebt
                                  ? 'สร้างอัตโนมัติจากทริป'
                                  : 'สร้างอัตโนมัติจากธุรกรรม'}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => onDelete(debt.id!)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                ลบ
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
                <TableHead>รายการ</TableHead>
                <TableHead className="w-[140px]">{personRole}</TableHead>
                <TableHead className="w-[90px]">แหล่ง</TableHead>
                <TableHead className="w-[120px] text-right">จำนวนเงิน</TableHead>
                <TableHead className="w-[140px] text-right">การดำเนินการ</TableHead>
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
                    const itemLabel = resolveDebtDescription(debt, txById)
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
                              จ่ายแล้ว {formatDebtAmount(debt.paidAmount)}
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
                            {debtSourceLabel(debt)}
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
                                    จ่ายคืน
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-1.5 size-3.5" aria-hidden />
                                    รับเงิน
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
                                  aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${itemLabel}`}
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
                                    ดูรายละเอียดธุรกรรม
                                  </DropdownMenuItem>
                                )}
                                {debt.isTripDebt || debt.isTransactionDebt ? (
                                  <DropdownMenuItem disabled>
                                    {debt.isTripDebt
                                      ? 'สร้างอัตโนมัติจากทริป'
                                      : 'สร้างอัตโนมัติจากธุรกรรม'}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => onDelete(debt.id!)}
                                  >
                                    <Trash2 className="mr-2 size-4" />
                                    ลบ
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
  const { t } = useLocale()

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

      let label = 'การชำระหนี้'
      if (settlement.tripId) {
        label = 'ค่าใช้จ่ายจากทริป'
      } else if (settlement.note?.startsWith('debt:')) {
        const debt = debtById.get(settlement.note.slice(5))
        label = debt
          ? resolveDebtDescription({ ...debt, isTransactionDebt: (debt.relatedTxIds?.length ?? 0) > 0 }, txById)
          : 'ชำระหนี้'
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
        label: resolveDebtDescription(debt as UIGlobalDebt, txById),
        person: isReceived
          ? debt.fromDisplayName || debt.fromUserId
          : debt.toDisplayName || debt.toUserId,
        isReceived,
        amount: debt.paidAmount || debt.amount,
        date: resolveSettledDebtDate(debt, txById),
        source: (debt.relatedTxIds?.length ?? 0) > 0 ? 'ธุรกรรม' : 'บันทึกเอง',
      })
    })

    return items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
  }, [paymentSettlements, debts, debtById, user?.uid, txById])

  const groupedPaymentHistory = React.useMemo(
    () => groupItemsByDate(paymentHistory, (item) => item.date),
    [paymentHistory]
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
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง')
      return
    }
    if (payAmount > settleDebtData.amount) {
      toast.error('จำนวนเงินเกินยอดคงเหลือ')
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
          payAmount
        )

        for (const { tripId, amount } of allocations) {
          await createTripSettlement({
            userId: user!.uid,
            tripId,
            fromUserId: settleDebtData.fromUserId,
            fromDisplayName: settleDebtData.fromDisplayName || settleDebtData.fromUserId,
            toUserId: settleDebtData.toUserId,
            toDisplayName: settleDebtData.toDisplayName || settleDebtData.toUserId,
            amount,
            isPartial: payAmount < settleDebtData.amount - 0.001,
            date: Timestamp.now(),
          })
        }

        const counterpartyName =
          settleDebtData.fromUserId === user!.uid
            ? settleDebtData.toDisplayName || settleDebtData.toUserId
            : settleDebtData.fromDisplayName || settleDebtData.fromUserId

        await createDebtSettlementTransaction(user!.uid, {
          amount: payAmount,
          isPayer: settleDebtData.fromUserId === user!.uid,
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
      toast.success(isPartial ? 'บันทึกการจ่ายบางส่วนแล้ว' : 'ชำระครบแล้ว')
      setIsSettleOpen(false)
      setSettleDebtData(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกการชำระไม่สำเร็จ')
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

  const handleDeletePayment = async (payment: PaymentHistoryItem) => {
    if (deletingPaymentId) return

    setDeletingPaymentId(payment.id)
    try {
      if (payment.settlementId) {
        const settlement = paymentSettlements.find((s) => s.id === payment.settlementId)
        if (!settlement) {
          toast.error('ไม่พบรายการชำระ')
          return
        }

        const linkedTx =
          findDebtPaymentTransaction(transactions, settlement) ??
          findTripBatchDebtPaymentTransaction(transactions, settlement)

        if (linkedTx?.id) {
          await removeTransaction(linkedTx.id)
          toast.success('ลบการจ่ายคืนแล้ว')
          return
        }

        if (settlement.note?.startsWith('debt:')) {
          await reverseDebtPaymentFromSettlement(settlement)
          toast.success('ลบการจ่ายคืนแล้ว')
          return
        }

        await removeSettlement(settlement.id!)
        toast.success('ลบรายการชำระแล้ว')
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
        toast.success('ลบการจ่ายคืนแล้ว')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบรายการไม่สำเร็จ')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handleAddDebt = async () => {
    if (!newDebtPerson || !newDebtAmount || isNaN(parseFloat(newDebtAmount))) return
    
    await addDebt({
      fromUserId: newDebtType === 'owe' ? user!.uid : newDebtPerson,
      toUserId: newDebtType === 'owe' ? newDebtPerson : user!.uid,
      amount: parseFloat(newDebtAmount),
      relatedTxIds: [],
    })

    setIsAddOpen(false)
    setNewDebtPerson('')
    setNewDebtAmount('')
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Debts</h1>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            ดูชัดว่าใครติดใคร แล้วจ่ายคืนได้ในไม่กี่คลิก
          </p>
        </div>
        <Button
          className="w-full gap-2 sm:w-auto"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Record Debt
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Send className="size-4 text-destructive" aria-hidden />
              You owe
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-destructive sm:text-3xl">
              {formatDebtAmount(totalOwed)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {youOwe.length} active
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
              Owed to you
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-success sm:text-3xl">
              {formatDebtAmount(totalOwedToYou)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {owedToYou.length} active
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
              Net balance
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
                ? 'In your favor'
                : netBalance < 0
                  ? 'You settle more'
                  : 'All settled'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="you-owe" className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="you-owe" className="gap-2 px-3 py-2">
            <Send className="size-4 shrink-0" aria-hidden />
            <span>You Owe</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-label={`${youOwe.length} debts you owe`}
            >
              {youOwe.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="owed-to-you" className="gap-2 px-3 py-2">
            <Wallet className="size-4 shrink-0" aria-hidden />
            <span>Owed to You</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-label={`${owedToYou.length} debts owed to you`}
            >
              {owedToYou.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-3 py-2">
            <History className="size-4 shrink-0" aria-hidden />
            <span>History</span>
            <Badge
              variant="secondary"
              className="rounded-md tabular-nums"
              aria-label={`${paymentHistory.length} settlements`}
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
              onDelete={removeDebt}
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
              onDelete={removeDebt}
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
              <CardTitle>Settlement history</CardTitle>
              <CardDescription>
                การจ่ายคืนทั้งหมด รวมทริป ธุรกรรม และหนี้ที่บันทึกเอง
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
                              <div className="min-w-0">
                                <p className="font-medium text-balance">{payment.label}</p>
                                {payment.date && (
                                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                    {formatTransactionDisplayTime(payment.date)}
                                  </p>
                                )}
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {payment.isReceived ? 'รับจาก' : 'จ่ายให้'}{' '}
                                  <span className="text-foreground">{payment.person}</span>
                                </p>
                                <Badge variant="outline" className="mt-2 text-xs font-normal">
                                  {payment.source}
                                </Badge>
                              </div>
                              <p
                                className={cn(
                                  'shrink-0 font-semibold tabular-nums',
                                  payment.isReceived ? 'text-success' : 'text-destructive'
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
                                ? 'กำลังลบ...'
                                : 'ลบการจ่ายคืน'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">รายการ</TableHead>
                        <TableHead>คู่รายการ</TableHead>
                        <TableHead className="w-[90px]">แหล่ง</TableHead>
                        <TableHead className="pr-6 text-right">จำนวนเงิน</TableHead>
                        <TableHead className="w-[100px] text-right">การดำเนินการ</TableHead>
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
                                        : 'bg-destructive/15 text-destructive'
                                    )}
                                    aria-hidden
                                  >
                                    {payment.isReceived ? (
                                      <ArrowRight className="size-3.5 rotate-180" />
                                    ) : (
                                      <ArrowRight className="size-3.5" />
                                    )}
                                  </div>
                                  <span>
                                    {payment.isReceived ? 'รับจาก' : 'จ่ายให้'}{' '}
                                    {payment.person}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs font-normal">
                                  {payment.source}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'pr-6 text-right font-semibold tabular-nums',
                                  payment.isReceived
                                    ? 'text-success'
                                    : 'text-destructive'
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
                                  {deletingPaymentId === payment.id ? 'กำลังลบ...' : 'ลบ'}
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
            <DialogTitle>Record debt</DialogTitle>
            <DialogDescription>
              บันทึกใครติดใคร — ชัดเจน ไม่ต้องตามทวงเอง
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="debt-type">Direction</Label>
              <Select
                value={newDebtType}
                onValueChange={(v: 'owe' | 'owed') => setNewDebtType(v)}
              >
                <SelectTrigger id="debt-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owe">I owe someone</SelectItem>
                  <SelectItem value="owed">Someone owes me</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debt-person">
                {newDebtType === 'owe' ? 'Pay to' : 'Receive from'}
              </Label>
              <Input
                id="debt-person"
                placeholder="ชื่อเพื่อน"
                value={newDebtPerson}
                onChange={(e) => setNewDebtPerson(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debt-amount">Amount (฿)</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDebt} disabled={!canSaveDebt}>
              Save
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
            <DialogTitle>รายละเอียดธุรกรรม</DialogTitle>
            <DialogDescription>
              แก้ไขธุรกรรมนี้จะอัปเดตหนี้ที่เกี่ยวข้องโดยอัตโนมัติ
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
            <DialogTitle>{settleIsPayer ? 'จ่ายคืน' : 'รับเงินคืน'}</DialogTitle>
            <DialogDescription>
              {settleDebtData && (
                <>
                  {settleIsPayer ? 'จ่ายให้' : 'รับจาก'}{' '}
                  <span className="font-medium text-foreground">{settlePerson}</span>
                  {' — '}
                  {resolveDebtDescription(settleDebtData, txById)}
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
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-success/20 bg-success/5'
                )}
              >
                <p className="text-xs text-muted-foreground">ยอดคงเหลือ</p>
                <p
                  className={cn(
                    'mt-1 text-xl font-semibold tabular-nums',
                    settleIsPayer ? 'text-destructive' : 'text-success'
                  )}
                >
                  {formatDebtAmount(settleDebtData.amount)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-amount">จำนวนที่จ่าย (฿)</Label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  >
                    ฿
                  </span>
                  <Input
                    id="settle-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={settleDebtData.amount}
                    className="pl-8 text-lg font-semibold tabular-nums"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground text-pretty">
                  สามารถจ่ายบางส่วนได้
                  {settleIsPayer && (
                    <span className="mt-1 block">
                      จะสร้างธุรกรรม &quot;จ่ายหนี้ให้...&quot; ในรายการของคุณโดยอัตโนมัติ
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
                  จ่ายเต็มจำนวน
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
                  จ่ายครึ่งหนึ่ง
                </Button>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsSettleOpen(false)}
                  disabled={isSettling}
                >
                  ยกเลิก
                </Button>
                <Button onClick={handleConfirmSettle} disabled={isSettling}>
                  {isSettling ? 'กำลังบันทึก...' : 'ยืนยัน'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
