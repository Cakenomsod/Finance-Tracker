'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Receipt, Users, Calendar, MapPin, ArrowRight,
  Plus, Edit2, Trash2, MoreHorizontal, Lock, Plane,
  BarChart3, DollarSign, CheckCircle2, Sparkles,
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useTrips } from '@/hooks/use-trips'
import { useTransactions } from '@/hooks/use-transactions'
import { useAuth } from '@/hooks/use-auth'
import { useTripExpenses } from '@/hooks/use-trip-expenses'
import { useTripSettlements } from '@/hooks/use-trip-settlements'
import { TripExpenseFormV2 } from '@/components/trips/trip-expense-form'
import { TripAiPanel } from '@/components/trips/trip-ai-panel'
import { useUserSettings } from '@/hooks/use-user-settings'
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
  LEGACY_JPY_TO_THB,
} from '@/lib/trip-currency'
import { Timestamp } from 'firebase/firestore'
import { Search } from 'lucide-react'

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
  const { trips, loading: tripsLoading, removeTrip, endTrip, editTrip } = useTrips()
  const { transactions, loading: txLoading, addTransaction, editTransaction, removeTransaction } = useTransactions()

  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false)
  const [ocrDraft, setOcrDraft] = React.useState<Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'> | null>(null)
  const [pendingImmichAssetId, setPendingImmichAssetId] = React.useState<string | null>(null)
  const { aiTextProvider } = useUserSettings()
  const [isEditTripOpen, setIsEditTripOpen] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<TripExpense | null>(null)
  const [editTripMembers, setEditTripMembers] = React.useState<PickedMember[]>([])
  const [expenseSearch, setExpenseSearch] = React.useState('')
  const [expenseFilterPaidBy, setExpenseFilterPaidBy] = React.useState('all')
  const [expandedReceipts, setExpandedReceipts] = React.useState<Record<string, boolean>>({})

  const trip = trips.find((t) => t.id === tripId)
  const [editTripSettings, setEditTripSettings] = React.useState<TripSettingsValue>(tripSettingsFromTrip())

  React.useEffect(() => {
    if (trip) setEditTripSettings(tripSettingsFromTrip(trip))
  }, [trip?.id, trip?.countryCode, trip?.tripCurrency, trip?.exchangeRate])

  const tripTxs = transactions.filter((tx) => tx.tripId === tripId)
  // Record Payment Dialog state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false)
  const [recordPaymentData, setRecordPaymentData] = React.useState<{ from: string, to: string, amount: number } | null>(null)
  const [settlementAmount, setSettlementAmount] = React.useState<string>('')

  const loading = tripsLoading || txLoading

  // --- Trip Expenses (new system) ---
  const { expenses: tripExpenses, calcBalances, addExpense, editExpense, removeExpense } = useTripExpenses(tripId, trip)
  const { settlements: paymentHistory, recordSettlement } = useTripSettlements(tripId)

  /** Get display name from memberProfiles or fallback to key */
  const getDisplayName = (key: string) =>
    trip?.memberProfiles?.[key]?.displayName || key

  const members = trip?.members || []

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
      const payer = ex.paidBy || members[0]
      const split = ex.splitWith

      if (!split) return [] // Solo

      let involved = split === 'all' ? members : [payer, split].filter(m => members.includes(m))
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
          if (net[p.userId] !== undefined) {
            net[p.userId] += convertToHomeCurrency(p.amount, rawEx.currency, trip)
          }
        })
        rawEx.shares?.forEach((s: { userId: string; amount: number }) => {
          if (net[s.userId] !== undefined) {
            net[s.userId] -= convertToHomeCurrency(s.amount, rawEx.currency, trip)
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
  }, [members, trip])

  // --- Calculations ---
  const totalLegacyExpenses = tripTxs.reduce(
    (s, tx) => s + convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip),
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
      const amount = convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip)
      const payer = tx.paidBy || members[0]
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
        // specific person
        involved = [payer, split].filter((m) => members.includes(m))
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
    const newBalances = calcBalances(members, displayNames)

    // 3. Subtract settled amounts
    const settlementsNet: Record<string, number> = {}
    members.forEach(m => { settlementsNet[m] = 0 })
    paymentHistory.forEach(s => {
      if (settlementsNet[s.fromUserId] !== undefined) settlementsNet[s.fromUserId] += s.amount
      if (settlementsNet[s.toUserId] !== undefined) settlementsNet[s.toUserId] -= s.amount
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
  }, [tripTxs, members, calcBalances, paymentHistory, tripExpenses])

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
      splitLabel: !tx.splitWith ? '🙋 Solo' : tx.splitWith === 'all' ? '👥 All' : `🤝 ${tx.splitWith}`,
      isLegacy: true,
      rawTx: tx,
      rawEx: null
    }))

    const newExps = tripExpenses.map(ex => {
      const payersStr = ex.payers.map(p => p.displayName).join(', ')
      const splitLabel = ex.splitMode === 'solo' ? '🙋 Solo' : ex.splitMode === 'equal' ? '⚖️ Equal' : '✏️ Custom'
      return {
        id: ex.id,
        description: ex.description,
        amount: ex.totalAmount,
        category: ex.category,
        date: ex.date,
        paidBy: payersStr,
        splitLabel,
        isLegacy: false,
        rawTx: null,
        rawEx: ex
      }
    })

    const combined = [...legacy, ...newExps]
    combined.sort((a, b) => {
      const dateA = a.date?.seconds || 0
      const dateB = b.date?.seconds || 0
      return dateB - dateA
    })
    return combined
  }, [tripTxs, tripExpenses])

  const itemizedDebtStates = React.useMemo(() => {
    const sortedExps = [...allExpensesCombined].sort((a, b) => {
      const aTime = a.date?.seconds || 0
      const bTime = b.date?.seconds || 0
      return aTime - bTime
    })

    const pool: Record<string, Record<string, number>> = {}
    paymentHistory.forEach(s => {
      const from = s.fromUserId
      const to = s.toUserId
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
  }, [allExpensesCombined, paymentHistory, calculateExpenseTransfers])

  const filteredExpenses = allExpensesCombined.filter((ex) => {
    const matchSearch = !expenseSearch ||
      ex.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      ex.category?.toLowerCase().includes(expenseSearch.toLowerCase())

    const matchPaidBy = expenseFilterPaidBy === 'all' ||
      (ex.isLegacy ? ex.paidBy === expenseFilterPaidBy : ex.paidBy.includes(getDisplayName(expenseFilterPaidBy)))

    return matchSearch && matchPaidBy
  })

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

  // Category breakdown for this trip
  const categoryData = React.useMemo(() => {
    const catMap = new Map<string, number>()
    allExpensesCombined.forEach((ex) => {
      const cat = ex.category || 'Others'
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(ex.amount))
    })
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [allExpensesCombined])

  // Per-person bar chart data
  const perPersonData = participants.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    paid: p.paid,
    net: p.netBalance,
  }))

  const meParticipant = participants.find((p) => p.name === user?.uid || p.name.toLowerCase() === 'me')
  const myBalance = meParticipant ? meParticipant.netBalance : 0

  const startDate = trip?.startDate?.seconds ? new Date(trip.startDate.seconds * 1000) : null
  const endDate = trip?.endDate?.seconds ? new Date(trip.endDate.seconds * 1000) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Plane className="mx-auto size-8 animate-pulse text-muted-foreground" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Plane className="size-12 text-muted-foreground/50" />
        <p className="text-lg font-medium">Trip not found</p>
        <Button variant="outline" onClick={() => router.push('/trips')}>
          <ArrowLeft className="mr-2 size-4" /> Back to Trips
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/trips')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
              <Badge variant={trip.status === 'active' ? 'default' : 'secondary'}
                className={cn(trip.status === 'active' && 'bg-primary/20 text-primary')}>
                {trip.status === 'active' ? 'Active' : 'Closed'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {trip.description && (
                <span className="flex items-center gap-1"><MapPin className="size-3" />{trip.description}</span>
              )}
              {startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {endDate && startDate.toDateString() !== endDate.toDateString() &&
                    ` - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trip.status === 'active' && (
            <Button className="gap-2" onClick={() => setIsAddExpenseOpen(true)}>
              <Plus className="size-4" /> Add Expense
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {trip.status === 'active' && (
                <>
                  <DropdownMenuItem onClick={() => endTrip(trip.id!)}>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={async () => {
                await removeTrip(trip.id!)
                router.push('/trips')
              }}>
                <Trash2 className="mr-2 size-4" /> Delete Trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="size-4" /> Total Expenses
            </div>
            <p className="mt-2 text-3xl font-bold">฿{totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" /> Participants
            </div>
            <p className="mt-2 text-3xl font-bold">{members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="size-4" /> Transactions
            </div>
            <p className="mt-2 text-3xl font-bold">{allExpensesCombined.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="size-4" /> Shared Splits
            </div>
            <p className="mt-2 text-3xl font-bold">{allExpensesCombined.filter(ex => !ex.splitLabel.includes('Solo')).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="w-full">
        <TabsList>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="size-4" /> Expenses
            <Badge variant="secondary" className="ml-1 rounded-full">{allExpensesCombined.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="size-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2">
            <Users className="size-4" /> Settlements
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="size-4" /> AI
          </TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All Expenses</CardTitle>
                  <CardDescription>{filteredExpenses.length} / {allExpensesCombined.length} transactions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหา..."
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="pl-9 w-[180px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setExpenseFilterPaidBy('all')}
                      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-all',
                        expenseFilterPaidBy === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-primary/50'
                      )}
                    >ทุกคน</button>
                    {members.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExpenseFilterPaidBy(m)}
                        className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-all',
                          expenseFilterPaidBy === m ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-primary/50'
                        )}
                      >{getDisplayName(m)}</button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allExpensesCombined.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  ยังไม่มีรายการ กดปุ่ม Add Expense เพื่อเพิ่ม
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">ไม่พบรายการที่ค้นหา</div>
              ) : (
                <div className="space-y-3">
                  {filteredExpenses.map((ex) => {
                    const txDate = ex.date?.seconds ? new Date(ex.date.seconds * 1000) : new Date()
                    const exCurrency = ex.rawTx?.currency || ex.rawEx?.currency || trip?.tripCurrency || 'THB'
                    const exSymbol = formatCurrencySymbol(exCurrency)
                    const exHomeHint = formatHomeConversion(ex.amount, exCurrency, trip)
                    return (
                      <div key={ex.id} className="group flex flex-col justify-start rounded-lg border p-4 transition-all hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted shrink-0">
                              <Receipt className="size-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{ex.description}</p>
                                {ex.isLegacy && <Badge variant="outline" className="text-[10px] h-4 px-1">Legacy</Badge>}
                                {ex.rawEx?.items && ex.rawEx.items.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      setExpandedReceipts(prev => ({ ...prev, [ex.id!]: !prev[ex.id!] }))
                                    }}
                                    className="h-5 px-1.5 text-[9px] text-muted-foreground hover:bg-muted flex items-center gap-1 ml-1"
                                  >
                                    {expandedReceipts[ex.id!] ? 'ซ่อนรายการ ▲' : 'ดูรายการใบเสร็จ ▼'}
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                จ่ายโดย {ex.paidBy || 'Me'} · {ex.category} · {ex.splitLabel} · {txDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="font-semibold tabular-nums block">
                                {exSymbol}{ex.amount.toLocaleString()}
                              </span>
                              {exHomeHint && (
                                <span className="text-[10px] text-muted-foreground block font-normal">
                                  ({exHomeHint})
                                </span>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  if (ex.isLegacy) {
                                    alert('Legacy transactions cannot be edited directly. Please delete and create a new expense.')
                                  } else {
                                    setEditingExpense(ex.rawEx as TripExpense)
                                    setIsAddExpenseOpen(true)
                                  }
                                }}>
                                  <Edit2 className="mr-2 size-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={async () => {
                                  if (ex.isLegacy) {
                                    removeTransaction(ex.id!)
                                  } else {
                                    const raw = ex.rawEx as TripExpense
                                    await deleteTripExpenseWithTransaction(ex.id!, raw?.transactionId)
                                  }
                                }}>
                                  <Trash2 className="mr-2 size-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Expandable Receipt breakdown details */}
                        {expandedReceipts[ex.id!] && ex.rawEx?.items && (
                          <div className="mt-3 border-t pt-3 space-y-2 text-xs">
                            <div className="flex justify-between text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                              <span>รายการสินค้า</span>
                              <span>ราคา & ภาษี</span>
                            </div>
                            <div className="space-y-1.5">
                              {ex.rawEx.items.map((item: any, i: number) => {
                                const itemTotal = item.price + (item.tax || 0)
                                return (
                                  <div key={i} className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-foreground">{item.name || 'สินค้า'}</span>
                                        <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.category}</span>
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[9px] text-muted-foreground">คนหาร:</span>
                                        <div className="flex gap-0.5">
                                          {(item.splitWith || []).map((k: string) => {
                                            const initials = getDisplayName(k).split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)
                                            return (
                                              <span key={k} title={getDisplayName(k)} className="size-4 rounded-full bg-primary/10 text-primary border border-primary/20 text-[8px] font-bold flex items-center justify-center shrink-0">
                                                {initials}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right font-medium tabular-nums shrink-0">
                                      <span>{exSymbol}{itemTotal.toLocaleString()}</span>
                                      {formatHomeConversion(itemTotal, exCurrency, trip) && (
                                        <span className="text-[9px] text-muted-foreground block font-normal">
                                          ({formatHomeConversion(itemTotal, exCurrency, trip)})
                                        </span>
                                      )}
                                      {item.tax > 0 ? (
                                        <span className="text-[9px] text-muted-foreground block">
                                          (สินค้า {exSymbol}{item.price.toLocaleString()} + ภาษี {exSymbol}{item.tax.toLocaleString()})
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-green-600 block">Tax free</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {ex.rawEx.baseAmount !== undefined && (
                              <div className="flex justify-between text-[10px] text-muted-foreground pt-1.5 border-t flex-wrap gap-1">
                                <span>ราคาสินค้ารวม: {exSymbol}{ex.rawEx.baseAmount.toLocaleString()} · ภาษีรวม: {exSymbol}{(ex.rawEx.taxAmount || 0).toLocaleString()}</span>
                                <span className="font-semibold text-foreground">
                                  ยอดรวมทั้งหมด: {exSymbol}{ex.amount.toLocaleString()} {exHomeHint && `(${exHomeHint})`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Per-person paid vs share */}
            <Card>
              <CardHeader>
                <CardTitle>Paid vs Share</CardTitle>
                <CardDescription>How much each person paid vs their fair share</CardDescription>
              </CardHeader>
              <CardContent>
                {perPersonData.length > 0 ? (
                  <ChartContainer config={{ paid: { label: 'Paid', color: 'var(--chart-1)' }, share: { label: 'Share', color: 'var(--chart-4)' } }} className="h-[250px] w-full">
                    <BarChart data={perPersonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="displayName" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `฿${v}`} className="text-xs fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="paid" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" fill="var(--chart-4)" radius={[4, 4, 0, 0]} opacity={0.5} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>By Category</CardTitle>
                <CardDescription>Expense breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <>
                    <ChartContainer config={chartConfig} className="mx-auto h-[180px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={categoryColors[i % categoryColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-4 space-y-2">
                      {categoryData.map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full" style={{ backgroundColor: categoryColors[i % categoryColors.length] }} />
                            <span>{cat.name}</span>
                          </div>
                          <span className="text-muted-foreground tabular-nums">฿{cat.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-muted-foreground">No expense data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-person detail table */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Per Person Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {participants.map((p) => {
                  const balance = p.netBalance
                  return (
                    <div key={p.name} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-xs bg-muted">{p.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{p.displayName}</p>
                          <p className="text-xs text-muted-foreground">จ่ายไป: ฿{p.paid.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('font-semibold tabular-nums', balance > 0 ? 'text-primary' : balance < 0 ? 'text-destructive' : '')}>
                          {balance > 0 ? '+' : ''}฿{balance.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{balance > 0 ? 'ได้รับคืน' : balance < 0 ? 'ต้องจ่ายคืน' : 'เท่ากัน'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlements Tab */}
        <TabsContent value="settlements" className="mt-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Settlement Plan</CardTitle>
                <CardDescription>Minimum transfers to settle all balances</CardDescription>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {totalExpenses === 0 ? 'No expenses yet' : 'Everyone is settled up! 🎉'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((s, i) => {
                      const fromName = getDisplayName(s.from)
                      const toName = getDisplayName(s.to)
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9">
                              <AvatarFallback className="text-xs bg-destructive/20 text-destructive">
                                {fromName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <ArrowRight className="size-4 text-muted-foreground" />
                            <Avatar className="size-9">
                              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                {toName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="ml-2">
                              <p className="text-sm font-medium">{fromName} → {toName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold tabular-nums">฿{s.amount.toLocaleString()}</span>
                            {trip.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
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
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Itemized Debts by Expense</CardTitle>
                <CardDescription>Breakdown of debts generated by each specific expense</CardDescription>
              </CardHeader>
              <CardContent>
                {allExpensesCombined.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No expenses recorded yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allExpensesCombined.map((ex) => {
                      const transfers = calculateExpenseTransfers(ex)
                      if (transfers.length === 0) return null

                      const exCurrency = ex.rawTx?.currency || ex.rawEx?.currency || trip?.tripCurrency || 'THB'
                    const exSymbol = formatCurrencySymbol(exCurrency)
                    const exHomeHint = formatHomeConversion(ex.amount, exCurrency, trip)
                      return (
                        <div key={ex.id || `${ex.description}-${ex.date?.seconds}`} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div>
                              <p className="font-semibold text-sm">{ex.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {ex.isLegacy ? 'Legacy Transaction' : ex.category || 'Expense'} • {ex.date?.seconds ? new Date(ex.date.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                              </p>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-right">
                              {exSymbol}{ex.amount.toLocaleString()}
                              {exHomeHint && (
                                <span className="text-[10px] text-muted-foreground block font-normal">
                                  ({exHomeHint})
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {transfers.map((t, index) => {
                              const fromName = getDisplayName(t.from)
                              const toName = getDisplayName(t.to)
                              const exId = ex.id || `${ex.description}-${ex.date?.seconds}`
                              const debtState = itemizedDebtStates[exId]?.[`${t.from}-${t.to}`] || { status: 'pending', paidAmount: 0, remainingAmount: t.amount }

                              return (
                                <div key={index} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-destructive">{fromName}</span>
                                    <span className="text-xs text-muted-foreground">owes</span>
                                    <span className="font-medium text-primary">{toName}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <span className="font-semibold tabular-nums block">{homeSymbol}{t.amount.toLocaleString()}</span>
                                      {trip?.tripCurrency === 'JPY' && homeCurrency === 'THB' && (trip.exchangeRate ?? 0) > 0 && (
                                        <span className="text-[9px] text-muted-foreground block">
                                          (¥{Math.round(t.amount / (trip.exchangeRate ?? LEGACY_JPY_TO_THB)).toLocaleString()})
                                        </span>
                                      )}
                                      {debtState.status === 'partial' && (
                                        <span className="text-[10px] text-muted-foreground block">Paid ฿{debtState.paidAmount.toLocaleString()}</span>
                                      )}
                                    </div>
                                    {debtState.status === 'paid' ? (
                                      <Badge className="bg-primary/20 text-primary border-0 text-xs hover:bg-primary/20 pointer-events-none">Paid</Badge>
                                    ) : (
                                      trip.status === 'active' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                                          onClick={() => {
                                            setRecordPaymentData({ from: t.from, to: t.to, amount: debtState.remainingAmount })
                                            setSettlementAmount(debtState.remainingAmount.toString())
                                            setIsRecordPaymentOpen(true)
                                          }}
                                        >
                                          Pay
                                        </Button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {allExpensesCombined.every(ex => calculateExpenseTransfers(ex).length === 0) && (
                      <div className="py-8 text-center text-muted-foreground">
                        No active itemized debts for the current expenses! 🎉
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recorded payments between members</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentHistory.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No payments recorded yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentHistory.map(s => {
                      const fromName = getDisplayName(s.fromUserId)
                      const toName = getDisplayName(s.toUserId)
                      const date = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date()
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                              <CheckCircle2 className="size-4 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">{fromName} paid {toName}</p>
                              <p className="text-xs text-muted-foreground">
                                {date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-green-600 tabular-nums">฿{s.amount.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          {trip && (
            <TripAiPanel
              tripId={tripId}
              trip={trip}
              tripMembers={memberObjects}
              aiTextProvider={aiTextProvider}
              onOpenExpenseForm={(draft, immichAssetId) => {
                setOcrDraft(draft)
                setPendingImmichAssetId(immichAssetId ?? null)
                setEditingExpense(null)
                setIsAddExpenseOpen(true)
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Edit Trip</DialogTitle>
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
          setPendingImmichAssetId(null)
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Edit Expense' : ocrDraft ? 'ตรวจสอบรายจ่ายจาก AI' : 'Add Trip Expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? 'Edit this expense'
                : ocrDraft
                  ? 'ข้อมูลจาก Gemini — แก้ไขได้ก่อนกดบันทึก'
                  : 'Add an expense to this trip'}
            </DialogDescription>
          </DialogHeader>
          <TripExpenseFormV2
            key={editingExpense?.id || (ocrDraft ? 'ocr-draft' : 'new')}
            tripMembers={memberObjects}
            myUserId={user?.uid || ''}
            tripDefaults={trip ? {
              countryCode: trip.countryCode,
              tripCurrency: trip.tripCurrency,
              homeCurrency: trip.homeCurrency,
              exchangeRate: trip.exchangeRate,
            } : undefined}
            initialData={editingExpense || (ocrDraft as TripExpense | null)}
            immichAssetId={pendingImmichAssetId ?? editingExpense?.immichAssetId}
            onSubmit={async (data) => {
              if (!user?.uid) return
              if (editingExpense?.id) {
                await updateTripExpenseWithTransaction(
                  editingExpense.id,
                  editingExpense.transactionId,
                  data,
                  user.uid,
                  {
                    immichAssetId: pendingImmichAssetId ?? editingExpense.immichAssetId,
                    source: data.source,
                  }
                )
              } else {
                await saveTripExpenseWithTransaction(
                  { ...data, tripId, userId: user.uid },
                  user.uid,
                  {
                    immichAssetId: pendingImmichAssetId,
                    source: data.source || (ocrDraft ? 'ai' : 'manual'),
                  }
                )
              }
              setIsAddExpenseOpen(false)
              setEditingExpense(null)
              setOcrDraft(null)
              setPendingImmichAssetId(null)
            }}
            onCancel={() => {
              setIsAddExpenseOpen(false)
              setEditingExpense(null)
              setOcrDraft(null)
              setPendingImmichAssetId(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Confirm that {recordPaymentData ? getDisplayName(recordPaymentData.from) : ''} paid {recordPaymentData ? getDisplayName(recordPaymentData.to) : ''}.
            </DialogDescription>
          </DialogHeader>
          {recordPaymentData && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Amount to Settle (฿)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-8 text-lg font-bold"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Total owed: ฿{recordPaymentData.amount.toLocaleString()}.
                  You can pay a smaller amount for partial settlement.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={async () => {
                  const payAmount = parseFloat(settlementAmount) || recordPaymentData.amount
                  await recordSettlement({
                    tripId,
                    fromUserId: recordPaymentData.from,
                    toUserId: recordPaymentData.to,
                    fromDisplayName: getDisplayName(recordPaymentData.from),
                    toDisplayName: getDisplayName(recordPaymentData.to),
                    amount: payAmount,
                    isPartial: payAmount < recordPaymentData.amount,
                    date: Timestamp.now(),
                  })
                  setIsRecordPaymentOpen(false)
                }}>
                  Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
