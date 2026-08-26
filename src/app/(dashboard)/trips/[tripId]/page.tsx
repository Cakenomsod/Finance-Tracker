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

function TripDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6" aria-busy="true" aria-label="Loading trip">
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
  const { t } = useLocale()
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

      let involved = split === 'all'
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
  const perPersonData = participants.map((p) => ({
    name: p.name,
    displayName: p.displayName.length > 10 ? `${p.displayName.slice(0, 9)}…` : p.displayName,
    paid: p.paid,
    net: p.netBalance,
  }))

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
          <p className="text-lg font-semibold tracking-tight">Trip not found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This trip may have been deleted, or you don&apos;t have access.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/trips')}>
          <ArrowLeft className="mr-2 size-4" /> Back to Trips
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
            aria-label="Back to trips"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">{trip.name}</h1>
              <Badge
                variant={trip.status === 'active' ? 'default' : 'secondary'}
                className={cn(trip.status === 'active' && 'bg-primary/15 text-primary hover:bg-primary/15')}
              >
                {trip.status === 'active' ? 'Active' : 'Closed'}
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
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {endDate && startDate.toDateString() !== endDate.toDateString() &&
                    ` – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {trip.status === 'active' && (
            <Button className="gap-2" onClick={() => setIsAddExpenseOpen(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Trip actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {trip.status === 'active' && (
                <>
                  <DropdownMenuItem onClick={() => setShowCloseConfirm(true)}>
                    <Lock className="mr-2 size-4" /> Close Trip
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
                    <Edit2 className="mr-2 size-4" /> Edit Trip
                  </DropdownMenuItem>
                </>
              )}
              {trip.status === 'closed' && (
                <DropdownMenuItem onClick={() => resumeTrip(trip.id!)}>
                  <Unlock className="mr-2 size-4" /> Reopen Trip
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="mr-2 size-4" /> Delete Trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total expenses</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {homeSymbol}{totalExpenses.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '40ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Your balance</p>
            <p className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl', amountColorClass(myBalance, 'text-foreground'))}>
              {myBalance > 0 ? '+' : ''}{homeSymbol}{myBalance.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {myBalance > 0 ? 'You are owed' : myBalance < 0 ? 'You owe' : 'Settled up'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '80ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Participants</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{members.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '120ms' }}>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Expenses</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{allExpensesCombined.length}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {allExpensesCombined.filter((ex) => !ex.splitLabel.includes('Solo')).length} shared
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI panel — แสดงทุกแท็บ สถานะแยกรายการ persist ต่อทริป */}
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
          <TabsTrigger value="expenses" className="min-w-0 gap-1 px-1.5 py-2 text-[11px] sm:gap-2 sm:px-3 sm:text-sm">
            <Receipt className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">Expenses</span>
            <Badge variant="secondary" className="ml-0.5 shrink-0 px-1.5 tabular-nums text-[10px] sm:ml-1">
              {allExpensesCombined.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-w-0 gap-1 px-1.5 py-2 text-[11px] sm:gap-2 sm:px-3 sm:text-sm">
            <BarChart3 className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settlements" className="min-w-0 gap-1 px-1.5 py-2 text-[11px] sm:gap-2 sm:px-3 sm:text-sm">
            <Users className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">Settle</span>
            {settlements.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 shrink-0 px-1.5 tabular-nums text-[10px] sm:ml-1">
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
                  <CardTitle>All expenses</CardTitle>
                  <CardDescription className="tabular-nums">
                    {filteredExpenses.length} of {allExpensesCombined.length} shown
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      placeholder="Search expenses…"
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="w-full pl-9 sm:w-[200px]"
                      aria-label="Search expenses"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by payer">
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
                      Everyone
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
                        {getDisplayName(m)}
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
                  <p className="mt-4 text-base font-medium">No expenses yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add your first trip expense, or capture a receipt with AI above.
                  </p>
                  {trip.status === 'active' && (
                    <Button size="sm" className="mt-4 gap-2" onClick={() => setIsAddExpenseOpen(true)}>
                      <Plus className="size-4" />
                      Add expense
                    </Button>
                  )}
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Search className="size-10 text-muted-foreground/50" aria-hidden />
                  <p className="mt-4 text-base font-medium">No matching expenses</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Try a different search or payer filter.
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
                    Clear filters
                  </Button>
                </div>
              ) : (
                <TripExpenseList
                  expenses={filteredExpenses}
                  trip={trip}
                  transactions={transactions}
                  getDisplayName={getDisplayName}
                  expandedReceipts={expandedReceipts}
                  onToggleReceipt={(id) =>
                    setExpandedReceipts((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  onView={handleViewExpense}
                  onEdit={(expense) => {
                    setEditingExpense(expense)
                    setIsAddExpenseOpen(true)
                  }}
                  onDeleteLegacy={(id, tx) => removeTransaction(id, tx)}
                  onDeleteExpense={async (id, raw) => {
                    await requestDeleteImmichAssets(collectImmichAssetIds(raw))
                    await deleteTripExpenseWithTransaction(id, raw.transactionId)
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
                <CardTitle>Paid vs balance</CardTitle>
                <CardDescription>How much each person paid and their net balance</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-hidden px-2 sm:px-6">
                {perPersonData.length > 0 ? (
                  <ChartContainer config={{ paid: { label: 'Paid', color: 'var(--chart-1)' }, share: { label: 'Net', color: 'var(--chart-4)' } }} className="aspect-auto h-[220px] w-full min-w-0 sm:h-[250px]">
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
                    <p className="font-medium text-foreground">No chart data yet</p>
                    <p>Add expenses to see paid vs balance by person.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>By category</CardTitle>
                <CardDescription>Expense breakdown by category</CardDescription>
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
                            <span className="truncate [overflow-wrap:anywhere]">{cat.name}</span>
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
                    <p className="font-medium text-foreground">No category data</p>
                    <p>Categories appear once expenses are logged.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-person detail table */}
          <Card className="mt-4 min-w-0 overflow-hidden shadow-sm lg:mt-6">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Per person summary</CardTitle>
              <CardDescription>Paid totals and who owes whom</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {participants.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Add members to see balances.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {participants.map((p) => {
                    const balance = p.netBalance
                    return (
                      <div key={p.name} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 shrink-0 sm:size-10">
                            <AvatarFallback className="bg-muted text-xs">{p.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium [overflow-wrap:anywhere]">{p.displayName}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              Paid {homeSymbol}{Math.round(p.paid).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('font-semibold tabular-nums', amountColorClass(balance))}>
                            {balance > 0 ? '+' : ''}{homeSymbol}{balance.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {balance > 0 ? 'Owed to them' : balance < 0 ? 'They owe' : 'Even'}
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
                <CardTitle>Settlement plan</CardTitle>
                <CardDescription>Minimum transfers to settle all balances</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {settlements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <CheckCircle2 className="size-10 text-success/70" aria-hidden />
                    <p className="mt-4 text-base font-medium">
                      {totalExpenses === 0 ? 'No expenses yet' : 'Everyone is settled up'}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {totalExpenses === 0
                        ? 'Once shared expenses exist, suggested transfers appear here.'
                        : 'No outstanding balances between members.'}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {settlements.map((s, i) => {
                      const fromName = getDisplayName(s.from)
                      const toName = getDisplayName(s.to)
                      return (
                        <li
                          key={`${s.from}-${s.to}-${i}`}
                          className="min-w-0 space-y-3 rounded-lg border bg-muted/40 p-3 transition-colors duration-200 sm:p-4"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="flex shrink-0 items-center gap-1.5 pt-0.5" aria-hidden>
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-destructive/15 text-[10px] text-destructive">
                                  {fromName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <ArrowRight className="size-3.5 text-muted-foreground" />
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                                  {toName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <p className="min-w-0 flex-1 text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                              <span className="text-destructive">{fromName}</span>
                              <span className="text-muted-foreground"> pays </span>
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
                                Record
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
                <CardTitle>Itemized debts</CardTitle>
                <CardDescription>Debts generated by each expense</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {allExpensesCombined.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <Receipt className="size-10 text-muted-foreground/50" aria-hidden />
                    <p className="mt-4 text-base font-medium">No expenses recorded</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Itemized who-owes-whom appears after shared expenses are added.
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
                                {ex.isLegacy ? 'Legacy' : ex.category || 'Expense'}
                                {' · '}
                                {ex.date?.seconds
                                  ? new Date(ex.date.seconds * 1000).toLocaleDateString('en-US', {
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
                                <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                                  ({exHomeHint})
                                </span>
                              )}
                            </div>
                          </div>

                          <ul className="space-y-1.5">
                            {transfers.map((t, index) => {
                              const fromName = getDisplayName(t.from)
                              const toName = getDisplayName(t.to)
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
                                    <span className="text-xs text-muted-foreground"> owes </span>
                                    <span className="font-medium text-primary">{toName}</span>
                                  </p>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <span className="block font-semibold tabular-nums">
                                        {homeSymbol}{t.amount.toLocaleString()}
                                      </span>
                                      {trip?.tripCurrency === 'JPY' && homeCurrency === 'THB' && (trip.exchangeRate ?? 0) > 0 && (
                                        <span className="block text-[10px] text-muted-foreground tabular-nums">
                                          (¥{Math.round(t.amount / (trip.exchangeRate ?? LEGACY_JPY_TO_THB)).toLocaleString()})
                                        </span>
                                      )}
                                      {debtState.status === 'partial' && (
                                        <span className="block text-[10px] text-muted-foreground tabular-nums">
                                          Paid {homeSymbol}{debtState.paidAmount.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    {debtState.status === 'paid' ? (
                                      <Badge className="pointer-events-none shrink-0 border-0 bg-primary/15 text-xs text-primary hover:bg-primary/15">
                                        Paid
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
                                          Pay
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
                        <p className="mt-4 text-base font-medium">No open itemized debts</p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          Shared expenses will show who owes whom for each item.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Payment history</CardTitle>
                <CardDescription>Recorded payments between members</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {paymentHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:px-4">
                    <CheckCircle2 className="size-10 text-muted-foreground/50" aria-hidden />
                    <p className="mt-4 text-base font-medium">No payments recorded</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Use Record or Pay on a settlement to log a transfer.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {paymentHistory.map((s) => {
                      const fromName = getDisplayName(s.fromUserId)
                      const toName = getDisplayName(s.toUserId)
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
                                {fromName} paid {toName}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {date.toLocaleDateString('th-TH', {
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
            <DialogTitle>Edit trip</DialogTitle>
            <DialogDescription>Update trip details and members</DialogDescription>
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
              <Label htmlFor="name">Trip Name</Label>
              <Input id="name" name="name" defaultValue={trip.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Location/Details)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={trip.description || ''}
                placeholder="e.g. Japan Spring Trip"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
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
                <Label htmlFor="endDate">End Date</Label>
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
              <Label>สมาชิก</Label>
              <MemberPicker
                value={editTripMembers}
                onChange={setEditTripMembers}
                selfUid={user?.uid}
              />
              <p className="text-xs text-muted-foreground">คุณจะถูกเพิ่มเป็นสมาชิกอัตโนมัติ</p>
            </div>
            <TripSettingsFields value={editTripSettings} onChange={setEditTripSettings} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditTripOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
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
              {editingExpense ? 'Edit expense' : ocrDraft ? 'Review AI expense' : 'Add trip expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? 'Update this expense — linked transactions stay in sync.'
                : ocrDraft
                  ? 'Parsed by AI — review and edit before saving.'
                  : 'Log an expense for this trip.'}
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
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Confirm that {recordPaymentData ? getDisplayName(recordPaymentData.from) : ''} paid{' '}
              {recordPaymentData ? getDisplayName(recordPaymentData.to) : ''}.
            </DialogDescription>
          </DialogHeader>
          {recordPaymentData && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="settlement-amount">Amount to settle ({homeSymbol})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
                    {homeSymbol}
                  </span>
                  <Input
                    id="settlement-amount"
                    type="number"
                    step="0.01"
                    className="pl-8 text-lg font-semibold tabular-nums"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Total owed: {homeSymbol}{recordPaymentData.amount.toLocaleString()}.
                  You can enter a smaller amount for a partial settlement.
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={async () => {
                  const payAmount = parseFloat(settlementAmount) || recordPaymentData.amount
                  const fromKey = resolveMember(recordPaymentData.from) || recordPaymentData.from
                  const toKey = resolveMember(recordPaymentData.to) || recordPaymentData.to
                  await recordSettlement(
                    {
                      tripId,
                      fromUserId: fromKey,
                      toUserId: toKey,
                      fromDisplayName: getDisplayName(fromKey),
                      toDisplayName: getDisplayName(toKey),
                      amount: payAmount,
                      isPartial: payAmount < recordPaymentData.amount,
                      date: Timestamp.now(),
                    },
                    {
                      accountId: accountsEnabled && settleAccountId ? settleAccountId : undefined,
                      moneyPoolId: moneyPoolsEnabled && settleMoneyPoolId ? settleMoneyPoolId : undefined,
                    }
                  )
                  setIsRecordPaymentOpen(false)
                  setSettleAccountId('')
                  setSettleMoneyPoolId('')
                }}>
                  Confirm payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing a trip prevents adding new expenses and recording payments.
              You can reopen it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await endTrip(tripId)
                setShowCloseConfirm(false)
              }}
            >
              Close Trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{trip.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the trip. Expenses and settlements linked to this trip
              will remain in the database but won&apos;t be visible until the trip is restored.
              This action cannot be undone from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await removeTrip(tripId)
                setShowDeleteConfirm(false)
                router.push('/trips')
              }}
            >
              Delete Trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
