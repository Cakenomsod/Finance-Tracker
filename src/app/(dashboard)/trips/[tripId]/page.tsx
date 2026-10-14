'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Receipt, Users, Calendar, MapPin, ArrowRight,
  Plus, Edit2, Trash2, MoreHorizontal, Lock, Unlock, Plane,
  BarChart3, CheckCircle2,
} from 'lucide-react'
import {
  Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis,
  CartesianGrid,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, amountColorClass } from '@/lib/utils'
import { toast } from 'sonner'
import { useTrips } from '@/hooks/use-trips'
import { useTripsData } from '@/hooks/use-trips-data-context'
import { useTransactions } from '@/hooks/use-transactions'
import { useAuth } from '@/hooks/use-auth'
import { useTripExpenses } from '@/hooks/use-trip-expenses'
import { useTripSettlements } from '@/hooks/use-trip-settlements'
import { TripExpenseFormV2 } from '@/components/trips/trip-expense-form'
import { TripExpenseList, type TripExpenseListItem } from '@/components/trips/trip-expense-list'
import { TransactionDetailDialog } from '@/components/transactions/transaction-detail-dialog'
import { TripAiPanel, type TripAiPanelHandle } from '@/components/trips/trip-ai-panel'
import {
  saveTripExpenseWithTransaction,
  updateTripExpenseWithTransaction,
  deleteTripExpenseWithTransaction,
} from '@/lib/sync-expense-transaction'
import { MemberPicker, PickedMember } from '@/components/trips/member-picker'
import { useUndoableDelete } from '@/hooks/use-undoable-delete'
import {
  TripSettingsFields,
  tripSettingsFromTrip,
  tripSettingsToFirestore,
  type TripSettingsValue,
} from '@/components/trips/trip-settings-fields'
import { Transaction, TripExpense } from '@/lib/firestore-types'
import {
  convertToHomeCurrency,
  formatCurrencySymbol,
  formatHomeConversion,
  getTripCurrencySettings,
  getTripTimeZone,
  LEGACY_JPY_TO_THB,
} from '@/lib/trip-currency'
import type { TripCurrencyCode } from '@/lib/tax/countries'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser'
import {
  getTripSelfMemberKey,
  isCurrentUserKey,
  resolveTripMemberKey,
} from '@/lib/trip-balance'
import { Timestamp } from 'firebase/firestore'
import { Search } from 'lucide-react'
import { PaymentSourceSelect } from '@/components/accounts/payment-source-select'
import { MoneyPoolSelect } from '@/components/accounts/money-pool-select'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useMoneyPools } from '@/hooks/use-money-pools'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useLocale } from '@/components/locale-provider'
import { categoryLabel } from '@/lib/default-categories'
import { intlLocale } from '@/lib/i18n'
import { MoneyInput } from '@/components/shared/money-input'

function TripDetailSkeleton() {
  const { p } = useLocale()
  return (
    <div
      className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6"
      aria-busy="true"
      aria-label={p({ th: 'กำลังโหลดทริป', en: 'Loading trip', zh: '正在加载行程' })}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

const chartConfig = {
  amount: { label: 'Amount', color: 'var(--chart-1)' },
}

const categoryColors = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--primary)',
  'var(--muted-foreground)',
]

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const { user } = useAuth()
  const { t, p, locale } = useLocale()
  const dateLocale = intlLocale(locale)
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useUndoableDelete()
  const { accountsEnabled, moneyPoolsEnabled } = useUserSettings()
  const { activeSources, defaultSource } = usePaymentSources()
  const { activePools } = useMoneyPools()
  const { trips, loading: tripsLoading, removeTrip, endTrip, resumeTrip, editTrip } = useTrips()
  const { addTransaction, editTransaction, removeTransaction } = useTransactions()
  const { legacyTripTransactions: transactions, loading: tripsDataLoading } = useTripsData()

  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false)
  const [ocrDraft, setOcrDraft] = React.useState<Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'> | null>(null)
  const [pendingImmichAssetIds, setPendingImmichAssetIds] = React.useState<string[]>([])
  const [isEditTripOpen, setIsEditTripOpen] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<TripExpense | null>(null)
  const [editTripMembers, setEditTripMembers] = React.useState<PickedMember[]>([])
  const [expenseSearch, setExpenseSearch] = React.useState('')
  const [expenseFilterPaidBy, setExpenseFilterPaidBy] = React.useState('all')
  const [expandedReceipts, setExpandedReceipts] = React.useState<Record<string, boolean>>({})
  const [isTxDetailOpen, setIsTxDetailOpen] = React.useState(false)
  const [detailTransaction, setDetailTransaction] = React.useState<Transaction | null>(null)
  const [detailTripExpense, setDetailTripExpense] = React.useState<TripExpense | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const tripAiPanelRef = React.useRef<TripAiPanelHandle>(null)

  const trip = trips.find((t) => t.id === tripId)
  const tripTimeZone = getTripTimeZone(trip?.countryCode, trip?.tripCurrency)
  const [editTripSettings, setEditTripSettings] = React.useState<TripSettingsValue>(tripSettingsFromTrip())

  React.useEffect(() => {
    if (trip) setEditTripSettings(tripSettingsFromTrip(trip))
  }, [trip?.id, trip?.countryCode, trip?.tripCurrency, trip?.exchangeRate])

  const tripTxs = transactions.filter((tx) => tx.tripId === tripId && !tx.tripExpenseId)
  // Record Payment Dialog state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false)
  const [recordPaymentData, setRecordPaymentData] = React.useState<{ from: string, to: string, amount: number } | null>(null)
  const [settlementAmount, setSettlementAmount] = React.useState<string>('')
  const [isRecordingPayment, setIsRecordingPayment] = React.useState(false)
  const settlementError = (() => {
    if (!recordPaymentData) return null
    const value = parseFloat(settlementAmount)
    if (!settlementAmount.trim() || !value || value <= 0) {
      return p({ th: 'ใส่จำนวนเงินที่มากกว่า 0', en: 'Enter an amount above 0', zh: '请输入大于 0 的金额' })
    }
    if (value > recordPaymentData.amount + 0.001) {
      return p({
        th: `เกินยอดค้าง (${recordPaymentData.amount.toLocaleString()})`,
        en: `More than what's owed (${recordPaymentData.amount.toLocaleString()})`,
        zh: `超过欠款（${recordPaymentData.amount.toLocaleString()}）`,
      })
    }
    return null
  })()
  const [settleAccountId, setSettleAccountId] = React.useState('')
  const [settleMoneyPoolId, setSettleMoneyPoolId] = React.useState('')

  React.useEffect(() => {
    if (isRecordPaymentOpen && defaultSource?.id && !settleAccountId) {
      setSettleAccountId(defaultSource.id)
    }
  }, [isRecordPaymentOpen, defaultSource?.id, settleAccountId])

  const loading = tripsLoading || tripsDataLoading

  // --- Trip Expenses (new system) ---
  const { expenses: tripExpenses, calcBalances, addExpense, editExpense, removeExpense } = useTripExpenses(tripId, trip)
  const { settlements: paymentHistory, recordSettlement } = useTripSettlements(tripId)

  /** Get display name from memberProfiles or fallback to key */
  const getDisplayName = (key: string) =>
    trip?.memberProfiles?.[key]?.displayName || key
  /** Display-only name: never feed this into saved payer/share data. */
  const showName = (key: string) => {
    const name = getDisplayName(key)
    return name === 'Me' ? p({ th: 'ฉัน', en: 'Me', zh: '我' }) : name
  }

  const members = trip?.members || []
  const selfMemberKey = React.useMemo(
    () => getTripSelfMemberKey(members, user?.uid) || user?.uid || 'Me',
    [members, user?.uid]
  )
  const resolveMember = React.useCallback(
    (key: string) => resolveTripMemberKey(key, members, user?.uid),
    [members, user?.uid]
  )

  /** Members as {key, displayName} array for forms */
  const memberObjects = members.map(k => ({ key: k, displayName: getDisplayName(k) }))

  interface ExpenseTransfer {
    from: string
    to: string
    amount: number
  }

  const calculateExpenseTransfers = React.useCallback((ex: any): ExpenseTransfer[] => {
    const net: Record<string, number> = {}
    members.forEach(m => net[m] = 0)

    if (ex.isLegacy) {
      // Legacy transaction
      const rawTx = ex.rawTx
      const amount = convertToHomeCurrency(Math.abs(ex.amount), rawTx?.currency, trip)
      const payer = resolveMember(ex.paidBy || members[0]) || members[0]
      const split = rawTx?.splitWith ?? ex.splitWith

      if (!split) return [] // Solo

      const involved = split === 'all'
        ? members
        : [payer, resolveMember(split)].filter((m): m is string => !!m && members.includes(m))
      if (involved.length === 0) return []

      const share = amount / involved.length

      net[payer] += amount - share
      involved.forEach(m => {
        if (m !== payer) net[m] -= share
      })
    } else {
      // New trip expense
      const rawEx = ex.rawEx
      if (rawEx) {
        rawEx.payers?.forEach((p: { userId: string; amount: number }) => {
          const key = resolveMember(p.userId)
          if (key && net[key] !== undefined) {
            net[key] += convertToHomeCurrency(p.amount, rawEx.currency, trip)
          }
        })
        rawEx.shares?.forEach((s: { userId: string; amount: number }) => {
          const key = resolveMember(s.userId)
          if (key && net[key] !== undefined) {
            net[key] -= convertToHomeCurrency(s.amount, rawEx.currency, trip)
          }
        })
      }
    }

    // Run greedy matching
    const transfers: ExpenseTransfer[] = []
    const balances = Object.keys(net).map(k => ({ id: k, balance: net[k] }))
    const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance)
    const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance)

    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const debt = Math.abs(debtors[i].balance)
      const credit = creditors[j].balance
      const amount = Math.min(debt, credit)

      if (amount > 0.01) {
        transfers.push({
          from: debtors[i].id,
          to: creditors[j].id,
          amount: Math.round(amount)
        })
      }

      debtors[i].balance += amount
      creditors[j].balance -= amount

      if (Math.abs(debtors[i].balance) < 0.01) i++
      if (creditors[j].balance < 0.01) j++
    }

    return transfers
  }, [members, trip, resolveMember])

  // --- Calculations ---
  const totalLegacyExpenses = tripTxs.reduce(
    (s, tx) => s + convertToHomeCurrency(Math.abs(tx.amount), tx.currency as TripCurrencyCode | undefined, trip),
    0
  )
  const totalNewExpenses = tripExpenses.reduce(
    (s, ex) => s + convertToHomeCurrency(ex.totalAmount, ex.currency, trip),
    0
  )
  const { homeCurrency } = getTripCurrencySettings(trip)
  const homeSymbol = formatCurrencySymbol(homeCurrency)
  const totalExpenses = totalLegacyExpenses + totalNewExpenses

  // Calculate each person's net balance based on legacy transactions + new expenses + settlements
  const participants = React.useMemo(() => {
    // 1. Calculate legacy (transactions)
    const net: Record<string, number> = {}
    const paid: Record<string, number> = {}
    members.forEach((m) => { net[m] = 0; paid[m] = 0 })

    tripTxs.forEach((tx) => {
      const amount = convertToHomeCurrency(Math.abs(tx.amount), tx.currency as TripCurrencyCode | undefined, trip)
      const payer = resolveMember(tx.paidBy || members[0]) || members[0]
      const split = tx.splitWith // null = solo, 'all' = everyone, 'Name' = specific

      if (paid[payer] !== undefined) paid[payer] += amount

      if (!split) {
        // Solo: only paidBy bears the cost, no effect on others
        return
      }

      let involved: string[] = []
      if (split === 'all') {
        involved = members.filter((m) => net[m] !== undefined)
      } else {
        const other = resolveMember(split)
        involved = [payer, other].filter((m): m is string => !!m && members.includes(m))
      }

      if (involved.length === 0) return
      const share = amount / involved.length

      // payer paid `amount` but only owes `share`
      if (net[payer] !== undefined) net[payer] += amount - share
      // others owe their share
      involved.forEach((m) => {
        if (m !== payer && net[m] !== undefined) net[m] -= share
      })
    })

    // 2. Add new expenses
    const displayNames = Object.fromEntries(members.map(m => [m, getDisplayName(m)]))
    const newBalances = calcBalances(members, displayNames, user?.uid)

    // 3. Subtract settled amounts (normalize Me ↔ uid)
    const settlementsNet: Record<string, number> = {}
    members.forEach(m => { settlementsNet[m] = 0 })
    paymentHistory.forEach(s => {
      const from = resolveMember(s.fromUserId)
      const to = resolveMember(s.toUserId)
      if (from && settlementsNet[from] !== undefined) settlementsNet[from] += s.amount
      if (to && settlementsNet[to] !== undefined) settlementsNet[to] -= s.amount
    })

    // 4. Merge all
    return members.map((member) => {
      const legacyPaid = paid[member] || 0
      const legacyNet = net[member] || 0

      const newBal = newBalances.find(b => b.userId === member)
      const newPaid = newBal?.totalPaid || 0
      const newNet = newBal?.netBalance || 0

      const settlementNet = settlementsNet[member] || 0

      const initials = getDisplayName(member).split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)

      return {
        name: member, // keep key as 'name' for backward compatibility
        displayName: getDisplayName(member),
        initials,
        paid: legacyPaid + newPaid,
        netBalance: Math.round(legacyNet + newNet + settlementNet)
      }
    })
  }, [tripTxs, members, calcBalances, paymentHistory, tripExpenses, resolveMember, user?.uid, trip])

  const allExpensesCombined = React.useMemo(() => {
    const legacy = tripTxs
      .filter((tx) => !tx.tripExpenseId)
      .map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: Math.abs(tx.amount),
      category: tx.category,
      date: tx.date,
      paidBy: tx.paidBy,
      splitLabel: !tx.splitWith ? 'Solo' : tx.splitWith === 'all' ? 'All' : tx.splitWith,
      isLegacy: true,
      currency: tx.currency as TripCurrencyCode | undefined,
      rawTx: tx,
      rawEx: null
    }))

    const newExps = tripExpenses.map(ex => {
      const payersStr = (ex.payers || []).map(p => p.displayName).join(', ')
      const splitLabel = ex.splitMode === 'solo' ? 'Solo' : ex.splitMode === 'equal' ? 'Equal' : 'Custom'
      return {
        id: ex.id,
        description: ex.description,
        amount: ex.totalAmount,
        category: ex.category,
        date: ex.date,
        paidBy: payersStr,
        splitLabel,
        isLegacy: false,
        currency: ex.currency,
        rawTx: null,
        rawEx: ex
      }
    })

    const combined = [...legacy, ...newExps]
    combined.sort((a, b) => {
      const dateA = a.date?.toMillis ? a.date.toMillis() : (a.date?.seconds || 0) * 1000
      const dateB = b.date?.toMillis ? b.date.toMillis() : (b.date?.seconds || 0) * 1000
      return dateB - dateA
    })
    return combined
  }, [tripTxs, tripExpenses])

  const itemizedDebtStates = React.useMemo(() => {
    const sortedExps = [...allExpensesCombined].sort((a, b) => {
      const aTime = a.date?.toMillis ? a.date.toMillis() : (a.date?.seconds || 0) * 1000
      const bTime = b.date?.toMillis ? b.date.toMillis() : (b.date?.seconds || 0) * 1000
      return aTime - bTime
    })

    // FIFO payment pool: oldest itemized debts first (normalize Me ↔ uid)
    const pool: Record<string, Record<string, number>> = {}
    paymentHistory.forEach(s => {
      const from = resolveMember(s.fromUserId) || s.fromUserId
      const to = resolveMember(s.toUserId) || s.toUserId
      if (!pool[from]) pool[from] = {}
      if (!pool[from][to]) pool[from][to] = 0
      pool[from][to] += s.amount
    })

    const states: Record<string, Record<string, { status: 'paid' | 'partial' | 'pending'; paidAmount: number; remainingAmount: number }>> = {}

    sortedExps.forEach(ex => {
      const transfers = calculateExpenseTransfers(ex)
      const exStates: Record<string, { status: 'paid' | 'partial' | 'pending'; paidAmount: number; remainingAmount: number }> = {}

      transfers.forEach(t => {
        const key = `${t.from}-${t.to}`
        const available = pool[t.from]?.[t.to] || 0

        if (available >= t.amount) {
          exStates[key] = {
            status: 'paid',
            paidAmount: t.amount,
            remainingAmount: 0
          }
          pool[t.from][t.to] -= t.amount
        } else if (available > 0.01) {
          exStates[key] = {
            status: 'partial',
            paidAmount: available,
            remainingAmount: t.amount - available
          }
          pool[t.from][t.to] = 0
        } else {
          exStates[key] = {
            status: 'pending',
            paidAmount: 0,
            remainingAmount: t.amount
          }
        }
      })

      states[ex.id || `${ex.description}-${ex.date?.seconds}`] = exStates
    })

    return states
  }, [allExpensesCombined, paymentHistory, calculateExpenseTransfers, resolveMember])

  const filteredExpenses = allExpensesCombined.filter((ex) => {
    if (ex.id && pendingDeleteIds.has(ex.id)) return false
    const matchSearch = !expenseSearch ||
      ex.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      ex.category?.toLowerCase().includes(expenseSearch.toLowerCase())

    const matchPaidBy = expenseFilterPaidBy === 'all' ||
      (ex.isLegacy ? ex.paidBy === expenseFilterPaidBy : ex.paidBy.includes(getDisplayName(expenseFilterPaidBy)))

    return matchSearch && matchPaidBy
  })

  const handleViewExpense = (ex: TripExpenseListItem) => {
    if (ex.isLegacy && ex.rawTx) {
      setDetailTripExpense(null)
      setDetailTransaction(ex.rawTx)
      setIsTxDetailOpen(true)
      return
    }
    if (ex.rawEx) {
      // Row click = read-only detail (avoids heavy edit-form Select crashes).
      // Edit stays on the row menu → TripExpenseFormV2.
      setDetailTransaction(null)
      setDetailTripExpense(ex.rawEx)
      setIsTxDetailOpen(true)
    }
  }

  // Settlements — greedy min-transfer algorithm
  const settlements = React.useMemo(() => {
    const result: { from: string; to: string; amount: number }[] = []
    const balances = participants.map((p) => ({ name: p.name, balance: p.netBalance }))
    const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance)
    const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance)
    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(Math.abs(debtors[i].balance), creditors[j].balance)
      if (amount > 1) result.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) })
      debtors[i].balance += amount
      creditors[j].balance -= amount
      if (Math.abs(debtors[i].balance) < 1) i++
      if (creditors[j].balance < 1) j++
    }
    return result
  }, [participants])

  // Category breakdown for this trip (always in home currency)
  const categoryData = React.useMemo(() => {
    const catMap = new Map<string, number>()
    allExpensesCombined.forEach((ex) => {
      const cat = ex.category || 'Others'
      const homeAmt = convertToHomeCurrency(Math.abs(ex.amount), ex.currency, trip)
      catMap.set(cat, (catMap.get(cat) || 0) + homeAmt)
    })
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [allExpensesCombined, trip])

  // Per-person bar chart data
  const perPersonData = participants.map((person) => {
    const label = showName(person.name)
    return {
      name: person.name,
      displayName: label.length > 10 ? `${label.slice(0, 9)}…` : label,
      paid: person.paid,
      net: person.netBalance,
    }
  })

  const meParticipant = participants.find((p) => isCurrentUserKey(p.name, user?.uid || ''))
  const myBalance = meParticipant ? meParticipant.netBalance : 0

  const startDate = trip?.startDate?.seconds ? new Date(trip.startDate.seconds * 1000) : null
  const endDate = trip?.endDate?.seconds ? new Date(trip.endDate.seconds * 1000) : null

  if (loading) {
    return <TripDetailSkeleton />
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Plane className="size-10 text-muted-foreground/50" aria-hidden />
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            {p({ th: 'ไม่พบทริปนี้', en: 'Trip not found', zh: '找不到该行程' })}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {p({
              th: 'ทริปนี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เปิดดู',
              en: "This trip may have been deleted, or you don't have access.",
              zh: '该行程可能已被删除，或你没有访问权限。',
            })}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/trips')}>
          <ArrowLeft className="mr-2 size-4" aria-hidden />{' '}
          {p({ th: 'กลับไปหน้าทริป', en: 'Back to trips', zh: '返回行程' })}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => router.push('/trips')}
            aria-label={p({ th: 'กลับไปหน้าทริป', en: 'Back to trips', zh: '返回行程' })}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">{trip.name}</h1>
              <Badge
                variant={trip.status === 'active' ? 'default' : 'secondary'}
                className={cn(trip.status === 'active' && 'bg-primary/15 text-primary hover:bg-primary/15')}
              >
                {trip.status === 'active'
                  ? p({ th: 'เปิดอยู่', en: 'Active', zh: '进行中' })
                  : p({ th: 'ปิดแล้ว', en: 'Closed', zh: '已结束' })}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {trip.description && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{trip.description}</span>
                </span>
              )}
              {startDate && (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Calendar className="size-3.5 shrink-0" aria-hidden />
                  {startDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                  {endDate && startDate.toDateString() !== endDate.toDateString() &&
                    ` – ${endDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {trip.status === 'active' && (
            <Button className="gap-2" onClick={() => setIsAddExpenseOpen(true)}>
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">
                {p({ th: 'เพิ่มค่าใช้จ่าย', en: 'Add expense', zh: '添加支出' })}
              </span>
              <span className="sm:hidden">{p({ th: 'เพิ่ม', en: 'Add', zh: '添加' })}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={p({ th: 'ตัวเลือกทริป', en: 'Trip actions', zh: '行程操作' })}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {trip.status === 'active' && (
                <>
                  <DropdownMenuItem onClick={() => setShowCloseConfirm(true)}>
                    <Lock className="mr-2 size-4" aria-hidden />{' '}
                    {p({ th: 'ปิดทริป', en: 'Close trip', zh: '结束行程' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    // convert trip.members to PickedMember[]
                    const picked = (trip.members || []).map(key => ({
                      key,
                      displayName: getDisplayName(key),
                      photoURL: trip.memberProfiles?.[key]?.photoURL || null,
                      isManual: !trip.memberProfiles?.[key],
                    }))
                    setEditTripMembers(picked)
                    setIsEditTripOpen(true)
                  }}>
                    <Edit2 className="mr-2 size-4" aria-hidden />{' '}
                    {p({ th: 'แก้ไขทริป', en: 'Edit trip', zh: '编辑行程' })}
                  </DropdownMenuItem>
                </>
              )}
              {trip.status === 'closed' && (
                <DropdownMenuItem onClick={() => resumeTrip(trip.id!)}>
                  <Unlock className="mr-2 size-4" aria-hidden />{' '}
                  {p({ th: 'เปิดทริปอีกครั้ง', en: 'Reopen trip', zh: '重新开启行程' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="mr-2 size-4" aria-hidden />{' '}
                {p({ th: 'ลบทริป', en: 'Delete trip', zh: '删除行程' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              {p({ th: 'ค่าใช้จ่ายรวม', en: 'Total expenses', zh: '总支出' })}
            </p>
            <p className="mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {homeSymbol}{totalExpenses.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '40ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              {p({ th: 'ยอดของคุณ', en: 'Your balance', zh: '你的余额' })}
            </p>
            <p className={cn('mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl', amountColorClass(myBalance, 'text-foreground'))}>
              {myBalance > 0 ? '+' : myBalance < 0 ? '−' : ''}{homeSymbol}{Math.abs(myBalance).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {myBalance > 0
                ? p({ th: 'มีคนต้องจ่ายคืนคุณ', en: 'You are owed', zh: '别人欠你' })
                : myBalance < 0
                  ? p({ th: 'คุณต้องจ่ายคืน', en: 'You owe', zh: '你欠别人' })
                  : p({ th: 'เคลียร์ครบแล้ว', en: 'Settled up', zh: '已结清' })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '80ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              {p({ th: 'สมาชิก', en: 'Participants', zh: '成员' })}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{members.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '120ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              {p({ th: 'จำนวนรายการ', en: 'Expenses', zh: '支出笔数' })}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{allExpensesCombined.length}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {(() => {
                const sharedCount = allExpensesCombined.filter((ex) => !ex.splitLabel.includes('Solo')).length
                return p({
                  th: `หารกัน ${sharedCount} รายการ`,
                  en: `${sharedCount} shared`,
                  zh: `${sharedCount} 笔分摊`,
                })
              })()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI panel — shown on every tab; item-split state persists per trip */}
      {trip && trip.status === 'active' && (
        <TripAiPanel
          ref={tripAiPanelRef}
          tripId={tripId}
          trip={trip}
          tripMembers={memberObjects}
          onOpenExpenseForm={(draft, immichAssetIds) => {
            setOcrDraft(draft)
            setPendingImmichAssetIds(immichAssetIds?.length ? [...immichAssetIds] : [])
            setEditingExpense(null)
            setIsAddExpenseOpen(true)
          }}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="w-full min-w-0">
        <TabsList className="grid h-auto w-full min-w-0 grid-cols-3 gap-1 p-1">
          <TabsTrigger value="expenses" className="min-w-0 gap-1 px-1.5 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Receipt className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">{p({ th: 'รายการ', en: 'Expenses', zh: '支出' })}</span>
            <Badge variant="secondary" className="ml-0.5 shrink-0 px-1.5 tabular-nums text-xs sm:ml-1">
              {allExpensesCombined.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-w-0 gap-1 px-1.5 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <BarChart3 className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">{p({ th: 'สรุป', en: 'Analytics', zh: '分析' })}</span>
          </TabsTrigger>
          <TabsTrigger value="settlements" className="min-w-0 gap-1 px-1.5 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Users className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">{p({ th: 'เคลียร์เงิน', en: 'Settle', zh: '结算' })}</span>
            {settlements.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 shrink-0 px-1.5 tabular-nums text-xs sm:ml-1">
                {settlements.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4 space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{p({ th: 'รายการทั้งหมด', en: 'All expenses', zh: '全部支出' })}</CardTitle>
                  <CardDescription className="tabular-nums">
                    {p({
                      th: `แสดง ${filteredExpenses.length} จาก ${allExpensesCombined.length} รายการ`,
                      en: `${filteredExpenses.length} of ${allExpensesCombined.length} shown`,
                      zh: `显示 ${filteredExpenses.length} / ${allExpensesCombined.length} 笔`,
                    })}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      placeholder={p({ th: 'ค้นหารายการ…', en: 'Search expenses…', zh: '搜索支出…' })}
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="w-full pl-9 sm:w-[200px]"
                      aria-label={p({ th: 'ค้นหารายการ', en: 'Search expenses', zh: '搜索支出' })}
                    />
                  </div>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={p({ th: 'กรองตามคนจ่าย', en: 'Filter by payer', zh: '按付款人筛选' })}
                  >
                    <button
                      type="button"
                      onClick={() => setExpenseFilterPaidBy('all')}
                      aria-pressed={expenseFilterPaidBy === 'all'}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                        expenseFilterPaidBy === 'all'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      {p({ th: 'ทุกคน', en: 'Everyone', zh: '所有人' })}
                    </button>
                    {members.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExpenseFilterPaidBy(m)}
                        aria-pressed={expenseFilterPaidBy === m}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                          expenseFilterPaidBy === m
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted'
                        )}
                      >
                        {showName(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allExpensesCombined.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Receipt className="size-10 text-muted-foreground/50" aria-hidden />
                  <p className="mt-4 text-base font-medium">
                    {p({ th: 'ยังไม่มีรายการ', en: 'No expenses yet', zh: '还没有支出' })}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {p({
                      th: 'เพิ่มค่าใช้จ่ายแรกของทริป หรือถ่ายรูปใบเสร็จให้ AI ช่วยอ่านด้านบน',
                      en: 'Add your first trip expense, or capture a receipt with AI above.',
                      zh: '添加第一笔行程支出，或在上方用 AI 识别收据。',
                    })}
                  </p>
                  {trip.status === 'active' && (
                    <Button size="sm" className="mt-4 gap-2" onClick={() => setIsAddExpenseOpen(true)}>
                      <Plus className="size-4" aria-hidden />
                      {p({ th: 'เพิ่มค่าใช้จ่าย', en: 'Add expense', zh: '添加支出' })}
                    </Button>
                  )}
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Search className="size-10 text-muted-foreground/50" aria-hidden />
                  <p className="mt-4 text-base font-medium">
                    {p({ th: 'ไม่พบรายการที่ตรงกัน', en: 'No matching expenses', zh: '没有匹配的支出' })}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {p({
                      th: 'ลองค้นหาคำอื่น หรือเลือกคนจ่ายคนอื่น',
                      en: 'Try a different search or payer filter.',
                      zh: '试试其他关键词或付款人筛选。',
                    })}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setExpenseSearch('')
                      setExpenseFilterPaidBy('all')
                    }}
                  >
                    {p({ th: 'ล้างตัวกรอง', en: 'Clear filters', zh: '清除筛选' })}
                  </Button>
                </div>
              ) : (
                <TripExpenseList
                  expenses={filteredExpenses}
                  trip={trip}
                  transactions={transactions}
                  getDisplayName={showName}
                  expandedReceipts={expandedReceipts}
                  onToggleReceipt={(id) =>
                    setExpandedReceipts((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  onView={handleViewExpense}
                  onEdit={(expense) => {
                    setEditingExpense(expense)
                    setIsAddExpenseOpen(true)
                  }}
                  onDeleteLegacy={(id, tx) =>
                    scheduleDelete(id, () => removeTransaction(id, tx), {
                      message: (() => {
                        const name = tx?.description || p({ th: 'รายการ', en: 'Expense', zh: '支出' })
                        return p({
                          th: `ลบ "${name}" แล้ว`,
                          en: `Deleted "${name}"`,
                          zh: `已删除“${name}”`,
                        })
                      })(),
                      undoLabel: t('common.undo'),
                    })
                  }
                  onDeleteExpense={async (id, raw) => {
                    scheduleDelete(
                      id,
                      async () => {
                        await requestDeleteImmichAssets(collectImmichAssetIds(raw))
                        await deleteTripExpenseWithTransaction(id, raw.transactionId)
                      },
                      {
                        message: (() => {
                          const name = raw.description || p({ th: 'รายการ', en: 'Expense', zh: '支出' })
                          return p({
                            th: `ลบ "${name}" แล้ว — ยอดหารของทุกคนในทริปจะคำนวณใหม่`,
                            en: `Deleted "${name}" — everyone's trip shares will be recalculated`,
                            zh: `已删除“${name}”——行程中每个人的分摊金额将重新计算`,
                          })
                        })(),
                        undoLabel: t('common.undo'),
                      }
                    )
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 min-w-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-6">
            {/* Per-person paid vs share */}
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>{p({ th: 'ใครจ่ายไปเท่าไหร่', en: 'Paid vs balance', zh: '已付与余额' })}</CardTitle>
                <CardDescription>
                  {p({
                    th: 'แต่ละคนจ่ายไปเท่าไหร่ และสุดท้ายต้องจ่ายคืนหรือได้คืนเท่าไหร่',
                    en: 'How much each person paid and their net balance',
                    zh: '每个人付了多少，以及净余额',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-hidden px-2 sm:px-6">
                {perPersonData.length > 0 ? (
                  <ChartContainer config={{ paid: { label: p({ th: 'จ่ายไป', en: 'Paid', zh: '已付' }), color: 'var(--chart-1)' }, share: { label: p({ th: 'ยอดสุทธิ', en: 'Net', zh: '净额' }), color: 'var(--chart-4)' } }} className="aspect-auto h-[220px] w-full min-w-0 sm:h-[250px]">
                    <BarChart data={perPersonData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis
                        dataKey="displayName"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tick={{ fontSize: 10 }}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => {
                          const n = Number(v)
                          if (Math.abs(n) >= 1000) return `${homeSymbol}${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
                          return `${homeSymbol}${n}`
                        }}
                        className="fill-muted-foreground"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="paid" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" fill="var(--chart-4)" radius={[4, 4, 0, 0]} opacity={0.5} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground sm:h-[250px]">
                    <p className="font-medium text-foreground">
                      {p({ th: 'ยังไม่มีข้อมูลกราฟ', en: 'No chart data yet', zh: '暂无图表数据' })}
                    </p>
                    <p>
                      {p({
                        th: 'เพิ่มค่าใช้จ่ายเพื่อดูว่าแต่ละคนจ่ายไปเท่าไหร่',
                        en: 'Add expenses to see paid vs balance by person.',
                        zh: '添加支出后即可查看每个人的已付与余额。',
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>{p({ th: 'แยกตามหมวดหมู่', en: 'By category', zh: '按类别' })}</CardTitle>
                <CardDescription>
                  {p({ th: 'ค่าใช้จ่ายแยกตามหมวดหมู่', en: 'Expense breakdown by category', zh: '按类别查看支出' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-hidden px-4 sm:px-6">
                {categoryData.length > 0 ? (
                  <>
                    <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-[160px] w-full min-w-0 sm:h-[180px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={categoryColors[i % categoryColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-4 space-y-2">
                      {categoryData.map((cat, i) => (
                        <div key={cat.name} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <div
                              className="size-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: categoryColors[i % categoryColors.length] }}
                              aria-hidden
                            />
                            <span className="truncate [overflow-wrap:anywhere]">{categoryLabel(cat.name, locale)}</span>
                          </div>
                          <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                            {homeSymbol}{cat.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground sm:h-[180px]">
                    <p className="font-medium text-foreground">
                      {p({ th: 'ยังไม่มีข้อมูลหมวดหมู่', en: 'No category data', zh: '暂无类别数据' })}
                    </p>
                    <p>
                      {p({
                        th: 'หมวดหมู่จะแสดงเมื่อมีการบันทึกค่าใช้จ่าย',
                        en: 'Categories appear once expenses are logged.',
                        zh: '记录支出后会显示类别。',
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-person detail table */}
          <Card className="mt-4 min-w-0 overflow-hidden shadow-sm lg:mt-6">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>{p({ th: 'สรุปรายคน', en: 'Per person summary', zh: '每人汇总' })}</CardTitle>
              <CardDescription>
                {p({ th: 'แต่ละคนจ่ายไปเท่าไหร่ และใครติดใคร', en: 'Paid totals and who owes whom', zh: '已付总额以及谁欠谁' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {participants.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {p({ th: 'เพิ่มสมาชิกเพื่อดูยอดของแต่ละคน', en: 'Add members to see balances.', zh: '添加成员后即可查看余额。' })}
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {participants.map((person) => {
                    const balance = person.netBalance
                    const paidText = `${homeSymbol}${Math.round(person.paid).toLocaleString()}`
                    return (
                      <div key={person.name} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 shrink-0 sm:size-10">
                            <AvatarFallback className="bg-muted text-xs">{person.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium [overflow-wrap:anywhere]">{showName(person.name)}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {p({ th: `จ่ายไป ${paidText}`, en: `Paid ${paidText}`, zh: `已付 ${paidText}` })}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('font-semibold tabular-nums', amountColorClass(balance))}>
                            {balance > 0 ? '+' : ''}{homeSymbol}{balance.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {balance > 0
                              ? p({ th: 'มีคนต้องคืนให้', en: 'Owed to them', zh: '别人欠TA' })
                              : balance < 0
                                ? p({ th: 'ต้องจ่ายคืน', en: 'They owe', zh: 'TA 欠别人' })
                                : p({ th: 'เคลียร์แล้ว', en: 'Even', zh: '持平' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlements Tab — mobile-first: stack + truncate; avoid avatar+name+amount overflow */}
        <TabsContent
          value="settlements"
          className="mt-4 min-w-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <div className="grid min-w-0 gap-4 lg:gap-6">
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>{p({ th: 'แผนเคลียร์เงิน', en: 'Settlement plan', zh: '结算方案' })}</CardTitle>
                <CardDescription>
                  {p({
                    th: 'โอนให้น้อยครั้งที่สุดเพื่อเคลียร์ยอดค้างทั้งหมด',
                    en: 'Minimum transfers to settle all balances',
                    zh: '用最少的转账结清所有余额',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {settlements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <CheckCircle2 className="size-10 text-success/70" aria-hidden />
                    <p className="mt-4 text-base font-medium">
                      {totalExpenses === 0
                        ? p({ th: 'ยังไม่มีรายการ', en: 'No expenses yet', zh: '还没有支出' })
                        : p({ th: 'ทุกคนเคลียร์ครบแล้ว', en: 'Everyone is settled up', zh: '大家都已结清' })}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {totalExpenses === 0
                        ? p({
                            th: 'เมื่อมีค่าใช้จ่ายที่หารกัน รายการที่ต้องโอนคืนจะแสดงที่นี่',
                            en: 'Once shared expenses exist, suggested transfers appear here.',
                            zh: '有分摊支出后，建议的转账会显示在这里。',
                          })
                        : p({
                            th: 'ไม่มีใครติดเงินใครแล้ว',
                            en: 'No outstanding balances between members.',
                            zh: '成员之间没有未结清的余额。',
                          })}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {settlements.map((s, i) => {
                      const fromName = showName(s.from)
                      const toName = showName(s.to)
                      return (
                        <li
                          key={`${s.from}-${s.to}-${i}`}
                          className="min-w-0 space-y-3 rounded-lg border bg-muted/40 p-3 transition-colors duration-200 sm:p-4"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="flex shrink-0 items-center gap-1.5 pt-0.5" aria-hidden>
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-destructive/15 text-xs text-destructive">
                                  {fromName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <ArrowRight className="size-3.5 text-muted-foreground" />
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                                  {toName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <p className="min-w-0 flex-1 text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                              <span className="text-destructive">{fromName}</span>
                              <span className="text-muted-foreground">
                                {p({ th: ' จ่ายคืน ', en: ' pays ', zh: ' 还给 ' })}
                              </span>
                              <span className="text-primary">{toName}</span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                            <span className="min-w-0 truncate text-base font-semibold tabular-nums sm:text-lg">
                              {homeSymbol}{s.amount.toLocaleString()}
                            </span>
                            {trip.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0"
                                onClick={() => {
                                  setRecordPaymentData(s)
                                  setSettlementAmount(s.amount.toString())
                                  setIsRecordPaymentOpen(true)
                                }}
                              >
                                {p({ th: 'บันทึกการจ่าย', en: 'Record', zh: '记录' })}
                              </Button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>{p({ th: 'ยอดค้างแยกตามรายการ', en: 'Itemized debts', zh: '逐笔欠款' })}</CardTitle>
                <CardDescription>
                  {p({
                    th: 'แต่ละรายการทำให้ใครติดใครเท่าไหร่',
                    en: 'Debts generated by each expense',
                    zh: '每笔支出产生的欠款',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {allExpensesCombined.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <Receipt className="size-10 text-muted-foreground/50" aria-hidden />
                    <p className="mt-4 text-base font-medium">
                      {p({ th: 'ยังไม่มีรายการ', en: 'No expenses recorded', zh: '还没有记录支出' })}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {p({
                        th: 'เมื่อเพิ่มค่าใช้จ่ายที่หารกัน จะเห็นว่าใครติดใครในแต่ละรายการ',
                        en: 'Itemized who-owes-whom appears after shared expenses are added.',
                        zh: '添加分摊支出后，会逐笔显示谁欠谁。',
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allExpensesCombined.map((ex) => {
                      const transfers = calculateExpenseTransfers(ex)
                      if (transfers.length === 0) return null

                      const exCurrency = (ex.rawTx?.currency || ex.rawEx?.currency || trip?.tripCurrency || 'THB') as TripCurrencyCode
                      const exSymbol = formatCurrencySymbol(exCurrency)
                      const exHomeHint = formatHomeConversion(ex.amount, exCurrency, trip)
                      return (
                        <div
                          key={ex.id || `${ex.description}-${ex.date?.seconds}`}
                          className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
                        >
                          <div className="flex min-w-0 flex-col gap-1.5 border-b pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                                {ex.description}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {ex.isLegacy
                                  ? p({ th: 'ส่วนตัว', en: 'Personal', zh: '个人' })
                                  : ex.category
                                    ? categoryLabel(ex.category, locale)
                                    : p({ th: 'ค่าใช้จ่าย', en: 'Expense', zh: '支出' })}
                                {' · '}
                                {ex.date?.seconds
                                  ? new Date(ex.date.seconds * 1000).toLocaleDateString(dateLocale, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      ...(tripTimeZone ? { timeZone: tripTimeZone } : {}),
                                    })
                                  : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <span className="text-sm font-semibold tabular-nums">
                                {exSymbol}{ex.amount.toLocaleString()}
                              </span>
                              {exHomeHint && (
                                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                  ({exHomeHint})
                                </span>
                              )}
                            </div>
                          </div>

                          <ul className="space-y-1.5">
                            {transfers.map((t, index) => {
                              const fromName = showName(t.from)
                              const toName = showName(t.to)
                              const exId = ex.id || `${ex.description}-${ex.date?.seconds}`
                              const debtState = itemizedDebtStates[exId]?.[`${t.from}-${t.to}`] || {
                                status: 'pending' as const,
                                paidAmount: 0,
                                remainingAmount: t.amount,
                              }

                              return (
                                <li
                                  key={index}
                                  className="min-w-0 space-y-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm sm:px-3"
                                >
                                  <p className="min-w-0 leading-snug [overflow-wrap:anywhere]">
                                    <span className="font-medium text-destructive">{fromName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p({ th: ' ติด ', en: ' owes ', zh: ' 欠 ' })}
                                    </span>
                                    <span className="font-medium text-primary">{toName}</span>
                                  </p>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <span className="block font-semibold tabular-nums">
                                        {homeSymbol}{t.amount.toLocaleString()}
                                      </span>
                                      {trip?.tripCurrency === 'JPY' && homeCurrency === 'THB' && (trip.exchangeRate ?? 0) > 0 && (
                                        <span className="block text-xs text-muted-foreground tabular-nums">
                                          (¥{Math.round(t.amount / (trip.exchangeRate ?? LEGACY_JPY_TO_THB)).toLocaleString()})
                                        </span>
                                      )}
                                      {debtState.status === 'partial' && (
                                        <span className="block text-xs text-muted-foreground tabular-nums">
                                          {p({
                                            th: `จ่ายแล้ว ${homeSymbol}${debtState.paidAmount.toLocaleString()}`,
                                            en: `Paid ${homeSymbol}${debtState.paidAmount.toLocaleString()}`,
                                            zh: `已付 ${homeSymbol}${debtState.paidAmount.toLocaleString()}`,
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    {debtState.status === 'paid' ? (
                                      <Badge className="pointer-events-none shrink-0 border-0 bg-primary/15 text-xs text-primary hover:bg-primary/15">
                                        {p({ th: 'จ่ายแล้ว', en: 'Paid', zh: '已付' })}
                                      </Badge>
                                    ) : (
                                      trip.status === 'active' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 shrink-0 px-2.5 text-xs hover:bg-primary/10 hover:text-primary"
                                          onClick={() => {
                                            setRecordPaymentData({
                                              from: t.from,
                                              to: t.to,
                                              amount: debtState.remainingAmount,
                                            })
                                            setSettlementAmount(debtState.remainingAmount.toString())
                                            setIsRecordPaymentOpen(true)
                                          }}
                                        >
                                          {p({ th: 'จ่ายคืน', en: 'Pay', zh: '还款' })}
                                        </Button>
                                      )
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}

                    {allExpensesCombined.every((ex) => calculateExpenseTransfers(ex).length === 0) && (
                      <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                        <CheckCircle2 className="size-10 text-success/70" aria-hidden />
                        <p className="mt-4 text-base font-medium">
                          {p({ th: 'ไม่มียอดค้าง', en: 'No open itemized debts', zh: '没有未结的逐笔欠款' })}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          {p({
                            th: 'ค่าใช้จ่ายที่หารกันจะแสดงว่าใครติดใครในแต่ละรายการ',
                            en: 'Shared expenses will show who owes whom for each item.',
                            zh: '分摊支出会逐笔显示谁欠谁。',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>{p({ th: 'ประวัติการจ่ายคืน', en: 'Payment history', zh: '还款记录' })}</CardTitle>
                <CardDescription>
                  {p({
                    th: 'การจ่ายคืนระหว่างสมาชิกที่บันทึกไว้',
                    en: 'Recorded payments between members',
                    zh: '成员之间已记录的还款',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {paymentHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <CheckCircle2 className="size-10 text-muted-foreground/50" aria-hidden />
                    <p className="mt-4 text-base font-medium">
                      {p({ th: 'ยังไม่มีการจ่ายคืน', en: 'No payments recorded', zh: '还没有还款记录' })}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {p({
                        th: 'กด "บันทึกการจ่าย" หรือ "จ่ายคืน" ด้านบนเพื่อบันทึกการโอน',
                        en: 'Use Record or Pay on a settlement to log a transfer.',
                        zh: '在结算项上点“记录”或“还款”即可登记转账。',
                      })}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {paymentHistory.map((s) => {
                      const fromName = showName(s.fromUserId)
                      const toName = showName(s.toUserId)
                      const date = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date()
                      return (
                        <li
                          key={s.id}
                          className="flex min-w-0 flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
                        >
                          <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:size-9">
                              <CheckCircle2 className="size-4 text-success" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                                {p({
                                  th: `${fromName} จ่ายคืน ${toName}`,
                                  en: `${fromName} paid ${toName}`,
                                  zh: `${fromName} 还给 ${toName}`,
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {date.toLocaleDateString(dateLocale, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 pl-10 font-semibold tabular-nums text-success sm:pl-0 sm:text-right">
                            {homeSymbol}{s.amount.toLocaleString()}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
        <DialogContent
          className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>{p({ th: 'แก้ไขทริป', en: 'Edit trip', zh: '编辑行程' })}</DialogTitle>
            <DialogDescription>
              {p({ th: 'แก้ไขรายละเอียดทริปและสมาชิก', en: 'Update trip details and members', zh: '更新行程信息和成员' })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const name = formData.get('name') as string
              const description = formData.get('description') as string
              const startStr = formData.get('startDate') as string
              const endStr = formData.get('endDate') as string

              const memberProfiles: Record<string, { displayName: string; photoURL: string | null }> =
                Object.fromEntries(editTripMembers.map(m => [m.key, { displayName: m.displayName, photoURL: m.photoURL || null }]))

              await editTrip(trip.id!, {
                name,
                description,
                startDate: startStr ? Timestamp.fromDate(new Date(startStr)) : undefined,
                endDate: endStr ? Timestamp.fromDate(new Date(endStr)) : undefined,
                members: editTripMembers.map(m => m.key),
                memberProfiles,
                ...tripSettingsToFirestore(editTripSettings),
              })
              setIsEditTripOpen(false)
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">{p({ th: 'ชื่อทริป', en: 'Trip name', zh: '行程名称' })}</Label>
              <Input id="name" name="name" defaultValue={trip.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                {p({ th: 'รายละเอียด (สถานที่ / โน้ต)', en: 'Description (location / details)', zh: '描述（地点/详情）' })}
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={trip.description || ''}
                placeholder={p({ th: 'เช่น เที่ยวญี่ปุ่นช่วงซากุระ', en: 'e.g. Japan Spring Trip', zh: '例如：日本春季之旅' })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{p({ th: 'วันเริ่ม', en: 'Start date', zh: '开始日期' })}</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={
                    trip.startDate?.seconds
                      ? new Date(trip.startDate.seconds * 1000).toISOString().split('T')[0]
                      : ''
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">{p({ th: 'วันสิ้นสุด', en: 'End date', zh: '结束日期' })}</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={
                    trip.endDate?.seconds
                      ? new Date(trip.endDate.seconds * 1000).toISOString().split('T')[0]
                      : ''
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{p({ th: 'สมาชิก', en: 'Members', zh: '成员' })}</Label>
              <MemberPicker
                value={editTripMembers}
                onChange={setEditTripMembers}
                selfUid={user?.uid}
              />
              <p className="text-xs text-muted-foreground">
                {p({
                  th: 'คุณจะถูกเพิ่มเป็นสมาชิกอัตโนมัติ',
                  en: "You're added as a member automatically",
                  zh: '你会自动成为成员',
                })}
              </p>
            </div>
            <TripSettingsFields value={editTripSettings} onChange={setEditTripSettings} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditTripOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{p({ th: 'บันทึกการแก้ไข', en: 'Save changes', zh: '保存更改' })}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddExpenseOpen} onOpenChange={(open) => {
        setIsAddExpenseOpen(open)
        if (!open) {
          setEditingExpense(null)
          setOcrDraft(null)
          setPendingImmichAssetIds([])
        }
      }}>
        <DialogContent
          className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>
              {editingExpense
                ? p({ th: 'แก้ไขค่าใช้จ่าย', en: 'Edit expense', zh: '编辑支出' })
                : ocrDraft
                  ? p({ th: 'ตรวจรายการที่ AI อ่านมา', en: 'Review AI expense', zh: '核对 AI 识别的支出' })
                  : p({ th: 'เพิ่มค่าใช้จ่ายทริป', en: 'Add trip expense', zh: '添加行程支出' })}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? p({
                    th: 'แก้ไขรายการนี้ รายการที่เชื่อมกันจะอัปเดตตามด้วย',
                    en: 'Update this expense — linked transactions stay in sync.',
                    zh: '更新这笔支出，关联的交易会同步更新。',
                  })
                : ocrDraft
                  ? p({
                      th: 'AI อ่านมาให้แล้ว ตรวจและแก้ไขก่อนบันทึก',
                      en: 'Parsed by AI — review and edit before saving.',
                      zh: '由 AI 识别，保存前请核对并修改。',
                    })
                  : p({ th: 'บันทึกค่าใช้จ่ายของทริปนี้', en: 'Log an expense for this trip.', zh: '记录这次行程的一笔支出。' })}
            </DialogDescription>
          </DialogHeader>
          <TripExpenseFormV2
            key={editingExpense?.id || (ocrDraft ? 'ocr-draft' : 'new')}
            tripMembers={memberObjects}
            myUserId={selfMemberKey}
            tripDefaults={trip ? {
              countryCode: trip.countryCode,
              tripCurrency: trip.tripCurrency,
              homeCurrency: trip.homeCurrency,
              exchangeRate: trip.exchangeRate,
            } : undefined}
            initialData={editingExpense || (ocrDraft as TripExpense | null)}
            tripId={tripId}
            pendingImmichAssetIds={pendingImmichAssetIds}
            onSubmit={async (data) => {
              if (!user?.uid) return
              if (editingExpense?.id) {
                await updateTripExpenseWithTransaction(
                  editingExpense.id,
                  editingExpense.transactionId,
                  data,
                  {
                    immichAssetIds: data.immichAssetIds,
                    immichAssetId: data.immichAssetIds?.[0] ?? data.immichAssetId ?? null,
                    source: data.source,
                  }
                )
              } else {
                await saveTripExpenseWithTransaction(
                  { ...data, tripId, userId: user.uid },
                  user.uid,
                  {
                    immichAssetIds: data.immichAssetIds,
                    immichAssetId: data.immichAssetIds?.[0] ?? data.immichAssetId ?? null,
                    source: data.source || (ocrDraft ? 'ai' : 'manual'),
                  }
                )
              }
              if (ocrDraft && !editingExpense) {
                tripAiPanelRef.current?.completeActiveJob()
              }
              setIsAddExpenseOpen(false)
              setEditingExpense(null)
              setOcrDraft(null)
              setPendingImmichAssetIds([])
            }}
            onCancel={() => {
              setIsAddExpenseOpen(false)
              setEditingExpense(null)
              setOcrDraft(null)
              setPendingImmichAssetIds([])
            }}
          />
        </DialogContent>
      </Dialog>

      <TransactionDetailDialog
        open={isTxDetailOpen}
        onOpenChange={(open) => {
          setIsTxDetailOpen(open)
          if (!open) {
            setDetailTransaction(null)
            setDetailTripExpense(null)
          }
        }}
        transaction={detailTransaction}
        tripExpense={detailTripExpense}
        onSaveTransaction={async (id, data) => {
          await editTransaction(id, data)
          setDetailTransaction(null)
          setDetailTripExpense(null)
        }}
      />

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent
          className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] p-4 sm:max-w-lg sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>{p({ th: 'บันทึกการจ่ายคืน', en: 'Record payment', zh: '记录还款' })}</DialogTitle>
            <DialogDescription>
              {recordPaymentData
                ? p({
                    th: `${showName(recordPaymentData.from)} จ่ายคืน ${showName(recordPaymentData.to)}`,
                    en: `${showName(recordPaymentData.from)} paid ${showName(recordPaymentData.to)}`,
                    zh: `${showName(recordPaymentData.from)} 还给 ${showName(recordPaymentData.to)}`,
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          {recordPaymentData && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="settlement-amount">
                  {p({ th: `จำนวนที่จ่าย (${homeSymbol})`, en: `Amount paid (${homeSymbol})`, zh: `还款金额（${homeSymbol}）` })}
                </Label>
                <MoneyInput
                  id="settlement-amount"
                  currencySymbol={homeSymbol}
                  symbolClassName="left-3 text-base"
                  min="0"
                  step="0.01"
                  className="h-12 text-lg font-semibold"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  aria-invalid={Boolean(settlementError)}
                  aria-describedby="settlement-amount-hint"
                />
                <p
                  id="settlement-amount-hint"
                  className={cn('text-xs tabular-nums', settlementError ? 'text-destructive' : 'text-muted-foreground')}
                  role={settlementError ? 'alert' : undefined}
                >
                  {settlementError ??
                    p({
                      th: `ยอดค้าง ${homeSymbol}${recordPaymentData.amount.toLocaleString()} — ใส่น้อยกว่านี้ได้ถ้าจ่ายบางส่วน`,
                      en: `Owed ${homeSymbol}${recordPaymentData.amount.toLocaleString()} — enter less for a partial payment`,
                      zh: `欠款 ${homeSymbol}${recordPaymentData.amount.toLocaleString()}，可输入更少金额部分还款`,
                    })}
                </p>
              </div>
              {(accountsEnabled || moneyPoolsEnabled) &&
                isCurrentUserKey(recordPaymentData.from, user?.uid || '') && (
                <div className="space-y-3 rounded-lg border border-dashed p-3">
                  <p className="text-xs text-muted-foreground text-pretty">
                    {t('accounts.settlePayFrom')}
                  </p>
                  {accountsEnabled && activeSources.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('accounts.fromAccount')}</Label>
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
              <DialogFooter className="gap-2">
                <Button variant="outline" className="h-10" onClick={() => setIsRecordPaymentOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  className="h-10"
                  disabled={Boolean(settlementError) || isRecordingPayment}
                  onClick={async () => {
                    const payAmount = parseFloat(settlementAmount)
                    if (!payAmount || payAmount <= 0 || payAmount > recordPaymentData.amount + 0.001) return
                    const fromKey = resolveMember(recordPaymentData.from) || recordPaymentData.from
                    const toKey = resolveMember(recordPaymentData.to) || recordPaymentData.to
                    setIsRecordingPayment(true)
                    try {
                      await recordSettlement(
                        {
                          tripId,
                          fromUserId: fromKey,
                          toUserId: toKey,
                          fromDisplayName: getDisplayName(fromKey),
                          toDisplayName: getDisplayName(toKey),
                          amount: payAmount,
                          isPartial: payAmount < recordPaymentData.amount - 0.001,
                          date: Timestamp.now(),
                        },
                        {
                          accountId: accountsEnabled && settleAccountId ? settleAccountId : undefined,
                          moneyPoolId: moneyPoolsEnabled && settleMoneyPoolId ? settleMoneyPoolId : undefined,
                        }
                      )
                      toast.success(
                        payAmount < recordPaymentData.amount - 0.001
                          ? p({ th: 'บันทึกการจ่ายบางส่วนแล้ว', en: 'Partial payment recorded', zh: '已记录部分还款' })
                          : p({ th: 'จ่ายครบแล้ว', en: 'Fully settled', zh: '已结清' })
                      )
                      setIsRecordPaymentOpen(false)
                      setSettleAccountId('')
                      setSettleMoneyPoolId('')
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : p({ th: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', en: 'Could not save. Try again.', zh: '保存失败，请重试' })
                      )
                    } finally {
                      setIsRecordingPayment(false)
                    }
                  }}
                >
                  {isRecordingPayment
                    ? t('common.saving')
                    : p({ th: 'ยืนยันการจ่าย', en: 'Confirm payment', zh: '确认还款' })}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{p({ th: 'ปิดทริปนี้ไหม?', en: 'Close this trip?', zh: '结束这次行程？' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {p({
                th: 'เมื่อปิดทริปแล้ว จะเพิ่มค่าใช้จ่ายหรือบันทึกการจ่ายคืนไม่ได้ ถ้าต้องการก็เปิดใหม่ได้ภายหลัง',
                en: 'Closing a trip prevents adding new expenses and recording payments. You can reopen it later if needed.',
                zh: '结束后将无法添加新支出或记录还款。如有需要，之后可以重新开启。',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await endTrip(tripId)
                setShowCloseConfirm(false)
              }}
            >
              {p({ th: 'ปิดทริป', en: 'Close trip', zh: '结束行程' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {p({ th: `ลบ "${trip.name}" ไหม?`, en: `Delete "${trip.name}"?`, zh: `删除“${trip.name}”？` })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {p({
                th: 'ทริปนี้จะถูกลบถาวร ค่าใช้จ่ายและการจ่ายคืนในทริปยังเก็บไว้ในระบบ แต่จะมองไม่เห็นจนกว่าจะกู้ทริปคืน และย้อนกลับจากในแอปไม่ได้',
                en: "This will permanently remove the trip. Expenses and settlements linked to this trip will remain in the database but won't be visible until the trip is restored. This action cannot be undone from the app.",
                zh: '这会永久删除该行程。关联的支出和还款仍保存在数据库中，但在行程恢复前不会显示。此操作无法在应用内撤销。',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await removeTrip(tripId)
                setShowDeleteConfirm(false)
                router.push('/trips')
              }}
            >
              {p({ th: 'ลบทริป', en: 'Delete trip', zh: '删除行程' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
