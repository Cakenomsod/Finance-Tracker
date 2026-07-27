'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Plane,
  Plus,
  Receipt,
  MoreHorizontal,
  ArrowRight,
  Calendar,
  MapPin,
  Check,
  Trash2,
  Lock,
  Unlock,
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTrips } from '@/hooks/use-trips'
import { useTripsData } from '@/hooks/use-trips-data-context'
import { useTransactions } from '@/hooks/use-transactions'
import { TransactionDetailDialog } from '@/components/transactions/transaction-detail-dialog'
import { shouldIgnoreRowClick } from '@/lib/row-click'
import { useAuth } from '@/hooks/use-auth'
import { Trip, Transaction, TripExpense, TripSettlement } from '@/lib/firestore-types'
import { MemberPicker, PickedMember } from '@/components/trips/member-picker'
import { TripExpenseFormV2 } from '@/components/trips/trip-expense-form'
import {
  TripSettingsFields,
  defaultTripSettings,
  tripSettingsToFirestore,
  type TripSettingsValue,
} from '@/components/trips/trip-settings-fields'
import { convertToHomeCurrency, formatCurrencySymbol, formatHomeConversion } from '@/lib/trip-currency'
import { saveTripExpenseWithTransaction } from '@/lib/sync-expense-transaction'
import { Timestamp } from 'firebase/firestore'

// --- Settlement calculation ---
interface Settlement {
  from: string
  to: string
  amount: number
}

interface ParticipantSummary {
  name: string
  initials: string
  paid: number
  share: number
  displayName?: string
  netBalance?: number
}

function calculateSettlements(participants: ParticipantSummary[]): Settlement[] {
  const settlements: Settlement[] = []
  const balances = participants.map((p) => ({
    name: p.name,
    balance: p.paid - p.share,
  }))

  const debtors = balances
    .filter((b) => b.balance < 0)
    .sort((a, b) => a.balance - b.balance)
  const creditors = balances
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debt = Math.abs(debtors[i].balance)
    const credit = creditors[j].balance
    const amount = Math.min(debt, credit)

    if (amount > 0) {
      settlements.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(amount),
      })
    }

    debtors[i].balance += amount
    creditors[j].balance -= amount

    if (Math.abs(debtors[i].balance) < 1) i++
    if (creditors[j].balance < 1) j++
  }

  return settlements
}

function formatTripDateRange(startDate: Date | null, endDate: Date | null) {
  if (!startDate) return null
  const start = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  if (!endDate || startDate.toDateString() === endDate.toDateString()) return start
  const end = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `${start} – ${end}`
}

function TripsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" aria-busy="true" aria-label="Loading trips">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

// --- Trip Card Component ---
function TripCard({
  trip,
  tripTransactions,
  tripExpenses = [],
  tripSettlements = [],
  onDeleteRequest,
  onCloseRequest,
  onReopen,
  onAddExpense,
  onViewTransaction,
}: {
  trip: Trip
  tripTransactions: Transaction[]
  tripExpenses?: TripExpense[]
  tripSettlements?: TripSettlement[]
  onDeleteRequest: (trip: Trip) => void
  onCloseRequest: (id: string) => void
  onReopen: (id: string) => void
  onAddExpense: (tripId: string) => void
  onViewTransaction: (tx: Transaction) => void
}) {
  const router = useRouter()
  const { user } = useAuth()

  // --- 1. Legacy Calculations ---
  const members = trip.members || []
  const net: Record<string, number> = {}
  const paid: Record<string, number> = {}
  members.forEach((m) => { net[m] = 0; paid[m] = 0 })

  tripTransactions.forEach((tx) => {
    const amount = convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip)
    const payer = tx.paidBy || members[0]
    const split = tx.splitWith

    if (paid[payer] !== undefined) paid[payer] += amount

    if (!split) return // Solo

    let involved: string[] = []
    if (split === 'all') {
      involved = members
    } else {
      involved = [payer, split].filter((m) => members.includes(m))
    }

    if (involved.length === 0) return
    const share = amount / involved.length

    if (net[payer] !== undefined) net[payer] += amount - share
    involved.forEach((m) => {
      if (m !== payer && net[m] !== undefined) net[m] -= share
    })
  })

  // --- 2. New Trip Expenses Calculations ---
  const newPaid: Record<string, number> = {}
  const newShare: Record<string, number> = {}
  members.forEach((m) => { newPaid[m] = 0; newShare[m] = 0 })

  tripExpenses.forEach((ex) => {
    ex.payers.forEach((p) => {
      if (newPaid[p.userId] !== undefined) {
        newPaid[p.userId] += convertToHomeCurrency(p.amount, ex.currency, trip)
      }
    })
    ex.shares.forEach((s) => {
      if (newShare[s.userId] !== undefined) {
        newShare[s.userId] += convertToHomeCurrency(s.amount, ex.currency, trip)
      }
    })
  })

  // --- 3. Settlements Calculations ---
  const settlementsNet: Record<string, number> = {}
  members.forEach((m) => { settlementsNet[m] = 0 })
  tripSettlements.forEach((s) => {
    if (settlementsNet[s.fromUserId] !== undefined) settlementsNet[s.fromUserId] += s.amount
    if (settlementsNet[s.toUserId] !== undefined) settlementsNet[s.toUserId] -= s.amount
  })

  // --- 4. Combine participants ---
  const getDisplayName = (key: string) => trip.memberProfiles?.[key]?.displayName || key

  const participants = members.map((member) => {
    const legacyPaid = paid[member] || 0
    const legacyNet = net[member] || 0

    const nPaid = newPaid[member] || 0
    const nShare = newShare[member] || 0
    const newNet = nPaid - nShare

    const setNet = settlementsNet[member] || 0
    const netBalance = Math.round(legacyNet + newNet + setNet)

    const displayName = getDisplayName(member)
    const initials = displayName.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)

    return {
      name: member,
      displayName,
      initials,
      paid: legacyPaid + nPaid,
      share: legacyPaid + nPaid - netBalance, // share = paid - netBalance
      netBalance,
    }
  })

  const settlements = calculateSettlements(participants)
  const totalLegacyExpenses = tripTransactions.reduce(
    (sum, tx) => sum + convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip),
    0
  )
  const totalNewExpenses = tripExpenses.reduce(
    (sum, ex) => sum + convertToHomeCurrency(ex.totalAmount, ex.currency, trip),
    0
  )
  const totalExpenses = totalLegacyExpenses + totalNewExpenses
  const expenseCount = tripTransactions.length + tripExpenses.length

  // Find "Me" balance
  const meParticipant = participants.find(
    (p) => p.name === user?.uid || p.name === 'Me' || p.name === 'me'
  )
  const myNetBalance = meParticipant ? meParticipant.netBalance : 0

  const startDate = trip.startDate
    ? new Date(trip.startDate.seconds * 1000)
    : null
  const endDate = trip.endDate ? new Date(trip.endDate.seconds * 1000) : null
  const dateRange = formatTripDateRange(startDate, endDate)
  const isActive = trip.status === 'active'
  const tripHref = `/trips/${trip.id}`

  const openTrip = () => router.push(tripHref)

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`Open trip ${trip.name}`}
      className={cn(
        'group cursor-pointer shadow-sm outline-none',
        'transition-[box-shadow,border-color] duration-200 ease-out',
        'hover:border-border hover:shadow-md',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'motion-reduce:transition-none'
      )}
      onClick={openTrip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openTrip()
        }
      }}
    >
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-wrap text-balance sm:text-lg">
                {trip.name}
              </CardTitle>
              <Badge
                variant={isActive ? 'default' : 'secondary'}
                className={cn(
                  'shrink-0',
                  isActive && 'bg-primary/15 text-primary hover:bg-primary/15'
                )}
              >
                {isActive ? 'Active' : 'Closed'}
              </Badge>
            </div>
            {trip.description && (
              <CardDescription className="flex items-start gap-1.5 text-pretty">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">{trip.description}</span>
              </CardDescription>
            )}
            {dateRange && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" aria-hidden />
                <span>{dateRange}</span>
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label={`Trip actions for ${trip.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {isActive && (
                <DropdownMenuItem onClick={() => onCloseRequest(trip.id!)}>
                  <Lock className="mr-2 size-4" />
                  Close Trip
                </DropdownMenuItem>
              )}
              {trip.status === 'closed' && (
                <DropdownMenuItem onClick={() => onReopen(trip.id!)}>
                  <Unlock className="mr-2 size-4" />
                  Reopen Trip
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDeleteRequest(trip)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete Trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ledger totals — flat, not nested cards */}
        <div className="flex items-end justify-between gap-4 border-y border-border/80 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Total expenses</p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
              ฿{totalExpenses.toLocaleString()}
            </p>
            {expenseCount > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {expenseCount} {expenseCount === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          {meParticipant && (
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-muted-foreground">Your balance</p>
              <p
                className={cn(
                  'mt-0.5 text-lg font-semibold tracking-tight tabular-nums sm:text-xl',
                  myNetBalance > 0
                    ? 'text-primary'
                    : myNetBalance < 0
                      ? 'text-destructive'
                      : 'text-foreground'
                )}
              >
                {myNetBalance > 0 ? '+' : ''}฿{myNetBalance.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {myNetBalance > 0
                  ? 'Owed to you'
                  : myNetBalance < 0
                    ? 'You owe'
                    : 'Settled'}
              </p>
            </div>
          )}
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex -space-x-2">
                {participants.slice(0, 5).map((participant) => (
                  <Avatar
                    key={participant.name}
                    className="size-8 border-2 border-card"
                    title={participant.displayName}
                  >
                    <AvatarFallback className="bg-muted text-xs">
                      {participant.initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {participants.length}{' '}
                {participants.length === 1 ? 'person' : 'people'}
                {participants.length > 5 && (
                  <span className="tabular-nums"> · +{participants.length - 5}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Settlements — compact rows, no nested card chrome */}
        {settlements.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Settlements needed</p>
            <ul className="divide-y divide-border/80 rounded-lg border border-border/80">
              {settlements.slice(0, 3).map((settlement, index) => (
                <li
                  key={`${settlement.from}-${settlement.to}-${index}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">
                      {getDisplayName(settlement.from)}
                    </span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="truncate font-medium">
                      {getDisplayName(settlement.to)}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    ฿{settlement.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            {settlements.length > 3 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                +{settlements.length - 3} more on trip detail
              </p>
            )}
          </div>
        )}

        {/* Recent expenses — flat list, no icon wells */}
        {tripTransactions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
              Recent expenses
              <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                ({tripTransactions.length})
              </span>
            </p>
            <ul className="divide-y divide-border/80">
              {tripTransactions.slice(0, 4).map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-3 py-2.5 text-left',
                      'rounded-md transition-colors duration-150 ease-out',
                      'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                      'focus-visible:ring-3 focus-visible:ring-ring/50',
                      'motion-reduce:transition-none'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (shouldIgnoreRowClick(e.target)) return
                      onViewTransaction(tx)
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Paid by {getDisplayName(tx.paidBy || 'Me')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-destructive">
                        −{formatCurrencySymbol(tx.currency || trip.tripCurrency || 'THB')}
                        {Math.abs(tx.amount).toLocaleString()}
                      </span>
                      {formatHomeConversion(Math.abs(tx.amount), tx.currency, trip) && (
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                          ({formatHomeConversion(Math.abs(tx.amount), tx.currency, trip)})
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {tripTransactions.length > 4 && (
              <p className="pt-1 text-xs text-muted-foreground">
                +{tripTransactions.length - 4} more on trip detail
              </p>
            )}
          </div>
        )}

        {isActive && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full transition-colors duration-150 ease-out motion-reduce:transition-none"
              onClick={(e) => {
                e.stopPropagation()
                onAddExpense(trip.id!)
              }}
            >
              <Receipt className="mr-2 size-4" />
              Add expense
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---
export default function TripsPage() {
  const { user } = useAuth()
  const {
    activeTrips,
    closedTrips,
    loading: tripsLoading,
    addTrip,
    removeTrip,
    endTrip,
    resumeTrip,
  } = useTrips()
  const { editTransaction } = useTransactions()
  const {
    tripExpenses: allTripExpenses,
    tripSettlements: allTripSettlements,
    legacyTripTransactions: transactions,
    loading: tripsDataLoading,
  } = useTripsData()

  // Create Trip Dialog state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [newTripName, setNewTripName] = React.useState('')
  const [newTripDescription, setNewTripDescription] = React.useState('')
  const [newTripStartDate, setNewTripStartDate] = React.useState('')
  const [newTripEndDate, setNewTripEndDate] = React.useState('')
  const [newTripMembers, setNewTripMembers] = React.useState<PickedMember[]>([])
  const [newTripSettings, setNewTripSettings] = React.useState<TripSettingsValue>(defaultTripSettings)

  // Add Expense Dialog state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false)
  const [expenseTripId, setExpenseTripId] = React.useState<string | null>(null)
  const [tripToClose, setTripToClose] = React.useState<string | null>(null)
  const [tripToDelete, setTripToDelete] = React.useState<Trip | null>(null)
  const [isTxDetailOpen, setIsTxDetailOpen] = React.useState(false)
  const [detailTransaction, setDetailTransaction] = React.useState<Transaction | null>(null)
  const expenseTrip = [...activeTrips, ...closedTrips].find(t => t.id === expenseTripId)
  const expenseMemberObjects = (expenseTrip?.members || []).map(k => ({
    key: k,
    displayName: expenseTrip?.memberProfiles?.[k]?.displayName || k,
  }))

  const loading = tripsLoading || tripsDataLoading

  // Group transactions by tripId
  const getTransactionsForTrip = (tripId: string) =>
    transactions.filter((tx) => tx.tripId === tripId && !tx.tripExpenseId)

  // All trip-related transactions (exclude sync'd copies of TripExpense rows)
  const allTripTransactions = transactions.filter(
    (tx) => tx.tripId && !tx.tripExpenseId
  )

  const resetCreateForm = () => {
    setNewTripName('')
    setNewTripDescription('')
    setNewTripStartDate('')
    setNewTripEndDate('')
    setNewTripMembers([])
    setNewTripSettings(defaultTripSettings())
  }

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return
    if (!user) return

    setIsCreating(true)
    try {
      // Always include self
      const selfMember: PickedMember = {
        key: user.uid,
        displayName: user.displayName || user.email || 'Me',
        photoURL: user.photoURL || null,
      }
      const allMembers = newTripMembers.some(m => m.key === user.uid)
        ? newTripMembers
        : [selfMember, ...newTripMembers]

      const memberProfiles: Record<string, { displayName: string; photoURL: string | null }> =
        Object.fromEntries(allMembers.map(m => [m.key, { displayName: m.displayName, photoURL: m.photoURL || null }]))

      await addTrip({
        name: newTripName.trim(),
        description: newTripDescription.trim(),
        members: allMembers.map(m => m.key),
        memberProfiles,
        startDate: newTripStartDate ? Timestamp.fromDate(new Date(newTripStartDate)) : Timestamp.now(),
        endDate: newTripEndDate ? Timestamp.fromDate(new Date(newTripEndDate)) : Timestamp.now(),
        ...tripSettingsToFirestore(newTripSettings),
      })

      setIsCreateOpen(false)
      resetCreateForm()
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddExpense = (tripId: string) => {
    setExpenseTripId(tripId)
    setIsAddExpenseOpen(true)
  }

  const handleViewTransaction = (tx: Transaction) => {
    setDetailTransaction(tx)
    setIsTxDetailOpen(true)
  }

  const tripById = React.useMemo(
    () => new Map([...activeTrips, ...closedTrips].map((t) => [t.id!, t])),
    [activeTrips, closedTrips]
  )

  // Stats
  const totalLegacyExpenses = allTripTransactions.reduce((sum, tx) => {
    const trip = tx.tripId ? tripById.get(tx.tripId) : undefined
    return sum + convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip)
  }, 0)
  const totalNewExpenses = allTripExpenses.reduce((sum, ex) => {
    const trip = tripById.get(ex.tripId)
    return sum + convertToHomeCurrency(ex.totalAmount, ex.currency, trip)
  }, 0)
  const totalTripExpenses = totalLegacyExpenses + totalNewExpenses
  const uniquePeople = new Set(
    [...activeTrips, ...closedTrips].flatMap((t) => t.members || [])
  )

  if (loading) {
    return <TripsPageSkeleton />
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Trips
          </h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Split group costs on trips and events — see totals and who owes whom at a glance.
          </p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) {
              resetCreateForm()
              setIsCreating(false)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="w-full shrink-0 gap-2 sm:w-auto">
              <Plus className="size-4" />
              New trip
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]"
          >
            <DialogHeader>
              <DialogTitle>Create trip</DialogTitle>
              <DialogDescription>
                Start a shared expense session. You are added as a member automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              <div className="grid gap-2">
                <Label htmlFor="trip-name">Trip name</Label>
                <Input
                  id="trip-name"
                  placeholder="e.g., Phuket Weekend"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trip-destination">Destination / notes</Label>
                <Input
                  id="trip-destination"
                  placeholder="e.g., Phuket, Thailand"
                  value={newTripDescription}
                  onChange={(e) => setNewTripDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="trip-start">Start date</Label>
                  <Input
                    id="trip-start"
                    type="date"
                    value={newTripStartDate}
                    onChange={(e) => setNewTripStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trip-end">End date</Label>
                  <Input
                    id="trip-end"
                    type="date"
                    value={newTripEndDate}
                    onChange={(e) => setNewTripEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Members</Label>
                <MemberPicker
                  value={newTripMembers}
                  onChange={setNewTripMembers}
                  selfUid={user?.uid}
                />
                <p className="text-xs text-muted-foreground">
                  คุณจะถูกเพิ่มเป็นสมาชิกอัตโนมัติ · You&apos;re added automatically
                </p>
              </div>
              <TripSettingsFields value={newTripSettings} onChange={setNewTripSettings} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTrip}
                disabled={!newTripName.trim() || isCreating}
              >
                {isCreating ? 'Creating…' : 'Create trip'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview strip — one composition, not identical icon-card grid */}
      <section
        aria-label="Trip overview"
        className="rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-6"
      >
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-0">
          <div className="sm:pr-6">
            <p className="text-xs font-medium text-muted-foreground">Active trips</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {activeTrips.length}
            </p>
          </div>
          <div className="border-t border-border/80 pt-4 sm:border-t-0 sm:border-l sm:px-6 sm:pt-0">
            <p className="text-xs font-medium text-muted-foreground">Trip expenses</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              ฿{totalTripExpenses.toLocaleString()}
            </p>
          </div>
          <div className="border-t border-border/80 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
            <p className="text-xs font-medium text-muted-foreground">People involved</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {uniquePeople.size}
            </p>
          </div>
        </div>
      </section>

      {/* Trips Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 sm:w-auto">
          <TabsTrigger value="active" className="gap-2">
            <Plane className="size-4" aria-hidden />
            Active
            {activeTrips.length > 0 && (
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {activeTrips.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <Check className="size-4" aria-hidden />
            Completed
            {closedTrips.length > 0 && (
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {closedTrips.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="active"
          className="mt-4 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          {activeTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activeTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  tripTransactions={getTransactionsForTrip(trip.id!)}
                  tripExpenses={allTripExpenses.filter((e) => e.tripId === trip.id)}
                  tripSettlements={allTripSettlements.filter((s) => s.tripId === trip.id)}
                  onDeleteRequest={setTripToDelete}
                  onCloseRequest={setTripToClose}
                  onReopen={resumeTrip}
                  onAddExpense={handleAddExpense}
                  onViewTransaction={handleViewTransaction}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 py-14 text-center shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <Plane className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-4 text-base font-semibold tracking-tight">
                No active trips yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
                Create a trip to track shared costs, split fairly, and settle up when you get home.
              </p>
              <Button
                className="mt-5 gap-2"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-4" />
                Create your first trip
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="completed"
          className="mt-4 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          {closedTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {closedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  tripTransactions={getTransactionsForTrip(trip.id!)}
                  tripExpenses={allTripExpenses.filter((e) => e.tripId === trip.id)}
                  tripSettlements={allTripSettlements.filter((s) => s.tripId === trip.id)}
                  onDeleteRequest={setTripToDelete}
                  onCloseRequest={setTripToClose}
                  onReopen={resumeTrip}
                  onAddExpense={handleAddExpense}
                  onViewTransaction={handleViewTransaction}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 py-14 text-center shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <Check className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-4 text-base font-semibold tracking-tight">
                No completed trips
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
                When you close a trip, it lands here — still readable for totals and settlements.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Expense to Trip Dialog */}
      <Dialog
        open={isAddExpenseOpen}
        onOpenChange={(open) => {
          setIsAddExpenseOpen(open)
          if (!open) setExpenseTripId(null)
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]"
        >
          <DialogHeader>
            <DialogTitle>Add trip expense</DialogTitle>
            <DialogDescription>
              {expenseTrip
                ? `Add a shared cost to “${expenseTrip.name}”. Split among participants.`
                : 'Add an expense to this trip. It will be split among participants.'}
            </DialogDescription>
          </DialogHeader>
          <TripExpenseFormV2
            tripId={expenseTripId || undefined}
            tripMembers={expenseMemberObjects}
            myUserId={user?.uid || ''}
            tripDefaults={expenseTrip ? {
              countryCode: expenseTrip.countryCode,
              tripCurrency: expenseTrip.tripCurrency,
              homeCurrency: expenseTrip.homeCurrency,
              exchangeRate: expenseTrip.exchangeRate,
            } : undefined}
            initialData={null}
            onSubmit={async (data) => {
              if (!expenseTripId || !user) return
              await saveTripExpenseWithTransaction(
                { ...data, tripId: expenseTripId, userId: user.uid },
                user.uid
              )
              setIsAddExpenseOpen(false)
              setExpenseTripId(null)
            }}
            onCancel={() => {
              setIsAddExpenseOpen(false)
              setExpenseTripId(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tripToClose} onOpenChange={(open) => !open && setTripToClose(null)}>
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
                if (tripToClose) {
                  await endTrip(tripToClose)
                  setTripToClose(null)
                }
              }}
            >
              Close trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!tripToDelete} onOpenChange={(open) => !open && setTripToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{tripToDelete?.name}&quot;?</AlertDialogTitle>
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
                if (tripToDelete?.id) {
                  await removeTrip(tripToDelete.id)
                  setTripToDelete(null)
                }
              }}
            >
              Delete trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransactionDetailDialog
        open={isTxDetailOpen}
        onOpenChange={(open) => {
          setIsTxDetailOpen(open)
          if (!open) setDetailTransaction(null)
        }}
        transaction={detailTransaction}
        onSaveTransaction={async (id, data) => {
          await editTransaction(id, data)
          setDetailTransaction(null)
        }}
      />
    </div>
  )
}
