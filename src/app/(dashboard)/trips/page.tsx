'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Plane,
  Plus,
  Users,
  Receipt,
  Calculator,
  MoreHorizontal,
  ArrowRight,
  Calendar,
  MapPin,
  Check,
  Edit2,
  Trash2,
  UserPlus,
  DollarSign,
  X,
  Lock,
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
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTrips } from '@/hooks/use-trips'
import { useTransactions } from '@/hooks/use-transactions'
import { useAuth } from '@/hooks/use-auth'
import { useTripExpenses } from '@/hooks/use-trip-expenses'
import { Trip, Transaction, TripExpense, TripSettlement } from '@/lib/firestore-types'
import { MemberPicker, PickedMember } from '@/components/trips/member-picker'
import { TripExpenseFormV2 } from '@/components/trips/trip-expense-form'
import { Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

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
}

function calculateParticipants(
  trip: Trip,
  tripTransactions: Transaction[]
): ParticipantSummary[] {
  const totalExpenses = tripTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  )
  const members = trip.members || []
  const sharePerPerson = members.length > 0 ? totalExpenses / members.length : 0

  return members.map((member) => {
    const paid = tripTransactions
      .filter((tx) => tx.paidBy === member)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const initials = member
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
    return {
      name: member,
      initials,
      paid,
      share: Math.round(sharePerPerson),
    }
  })
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

// --- Trip Card Component ---
// --- Trip Card Component ---
function TripCard({
  trip,
  tripTransactions,
  tripExpenses = [],
  tripSettlements = [],
  onDelete,
  onClose,
  onAddExpense,
}: {
  trip: Trip
  tripTransactions: Transaction[]
  tripExpenses?: TripExpense[]
  tripSettlements?: TripSettlement[]
  onDelete: (id: string) => void
  onClose: (id: string) => void
  onAddExpense: (tripId: string) => void
}) {
  const router = useRouter()
  const { user } = useAuth()

  // --- 1. Legacy Calculations ---
  const members = trip.members || []
  const net: Record<string, number> = {}
  const paid: Record<string, number> = {}
  members.forEach((m) => { net[m] = 0; paid[m] = 0 })

  tripTransactions.forEach((tx) => {
    const factor = tx.currency === 'JPY' ? 0.22 : 1
    const amount = Math.abs(tx.amount) * factor
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
    const factor = ex.currency === 'JPY' ? 0.22 : 1
    ex.payers.forEach((p) => {
      if (newPaid[p.userId] !== undefined) newPaid[p.userId] += p.amount * factor
    })
    ex.shares.forEach((s) => {
      if (newShare[s.userId] !== undefined) newShare[s.userId] += s.amount * factor
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
  const totalLegacyExpenses = tripTransactions.reduce((sum, tx) => sum + (tx.currency === 'JPY' ? Math.abs(tx.amount) * 0.22 : Math.abs(tx.amount)), 0)
  const totalNewExpenses = tripExpenses.reduce((sum, ex) => sum + (ex.currency === 'JPY' ? ex.totalAmount * 0.22 : ex.totalAmount), 0)
  const totalExpenses = totalLegacyExpenses + totalNewExpenses

  // Find "Me" balance
  const meParticipant = participants.find(
    (p) => p.name === user?.uid || p.name === 'Me' || p.name === 'me'
  )
  const myNetBalance = meParticipant ? meParticipant.netBalance : 0

  const startDate = trip.startDate
    ? new Date(trip.startDate.seconds * 1000)
    : null
  const endDate = trip.endDate ? new Date(trip.endDate.seconds * 1000) : null

  return (
    <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md" onClick={() => router.push(`/trips/${trip.id}`)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{trip.name}</CardTitle>
              <Badge
                variant={trip.status === 'active' ? 'default' : 'secondary'}
                className={cn(
                  trip.status === 'active' && 'bg-primary/20 text-primary'
                )}
              >
                {trip.status === 'active' ? 'Active' : 'Closed'}
              </Badge>
            </div>
            {trip.description && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="size-3" />
                {trip.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {trip.status === 'active' && (
                <DropdownMenuItem onClick={() => onClose(trip.id!)}>
                  <Lock className="mr-2 size-4" />
                  Close Trip
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(trip.id!)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete Trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {startDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-3" />
            {startDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
            {endDate &&
              startDate.toDateString() !== endDate.toDateString() && (
                <>
                  {' - '}
                  {endDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </>
              )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Total and Balance */}
        <div className="flex items-center justify-between rounded-lg bg-muted p-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold">
              ฿{totalExpenses.toLocaleString()}
            </p>
          </div>
          {meParticipant && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  myNetBalance > 0
                    ? 'text-primary'
                    : myNetBalance < 0
                    ? 'text-destructive'
                    : ''
                )}
              >
                {myNetBalance > 0 ? '+' : ''}฿{myNetBalance.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Participants</p>
            <div className="flex -space-x-2">
              {participants.map((participant) => (
                <Avatar
                  key={participant.name}
                  className="size-8 border-2 border-background"
                >
                  <AvatarFallback className="text-xs bg-muted">
                    {participant.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}

        {/* Settlements */}
        {settlements.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Settlements Needed</p>
            <div className="space-y-2">
              {settlements.map((settlement, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getDisplayName(settlement.from)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="font-medium">{getDisplayName(settlement.to)}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    ฿{settlement.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense list */}
        {tripTransactions.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">
              Recent Expenses ({tripTransactions.length})
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {tripTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Receipt className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {tx.paidBy || 'Me'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold tabular-nums text-sm block">
                      {tx.currency === 'JPY' ? '¥' : '฿'}{Math.abs(tx.amount).toLocaleString()}
                    </span>
                    {tx.currency === 'JPY' && (
                      <span className="text-[10px] text-muted-foreground block font-normal">
                        (฿{(Math.abs(tx.amount) * 0.22).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {tripTransactions.length > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  +{tripTransactions.length - 5} more expenses
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {trip.status === 'active' && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAddExpense(trip.id!)}
            >
              <Receipt className="mr-2 size-4" />
              Add Expense
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
  } = useTrips()
  const { transactions, loading: txLoading, addTransaction } = useTransactions()

  // Create Trip Dialog state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [newTripName, setNewTripName] = React.useState('')
  const [newTripDescription, setNewTripDescription] = React.useState('')
  const [newTripStartDate, setNewTripStartDate] = React.useState('')
  const [newTripEndDate, setNewTripEndDate] = React.useState('')
  const [newTripMembers, setNewTripMembers] = React.useState<PickedMember[]>([])

  // Add Expense Dialog state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false)
  const [expenseTripId, setExpenseTripId] = React.useState<string | null>(null)
  const expenseTrip = [...activeTrips, ...closedTrips].find(t => t.id === expenseTripId)
  const expenseMemberObjects = (expenseTrip?.members || []).map(k => ({
    key: k,
    displayName: expenseTrip?.memberProfiles?.[k]?.displayName || k,
  }))
  const { addExpense } = useTripExpenses(expenseTripId || '')

  const loading = tripsLoading || txLoading

  // Real-time listener for all user's trip expenses and settlements
  const [allTripExpenses, setAllTripExpenses] = React.useState<TripExpense[]>([])
  const [allTripSettlements, setAllTripSettlements] = React.useState<TripSettlement[]>([])

  React.useEffect(() => {
    if (!user) {
      setAllTripExpenses([])
      setAllTripSettlements([])
      return
    }

    const tripIds = [...activeTrips, ...closedTrips].map(t => t.id).filter(Boolean) as string[]
    if (tripIds.length === 0) {
      setAllTripExpenses([])
      setAllTripSettlements([])
      return
    }

    const queryTripIds = tripIds.slice(0, 30)

    // Listen to all expenses for these trips
    const qExp = query(
      collection(db, 'trip_expenses'),
      where('tripId', 'in', queryTripIds)
    )
    const unsubExp = onSnapshot(qExp, (snap) => {
      setAllTripExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as TripExpense)))
    }, (err) => console.error("Error loading all trip expenses:", err))

    // Listen to all settlements for these trips
    const qSet = query(
      collection(db, 'trip_settlements'),
      where('tripId', 'in', queryTripIds)
    )
    const unsubSet = onSnapshot(qSet, (snap) => {
      setAllTripSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSettlement)))
    }, (err) => console.error("Error loading all trip settlements:", err))

    return () => {
      unsubExp()
      unsubSet()
    }
  }, [user, activeTrips.length, closedTrips.length])

  // Group transactions by tripId
  const getTransactionsForTrip = (tripId: string) =>
    transactions.filter((tx) => tx.tripId === tripId)

  // All trip-related transactions
  const allTripTransactions = transactions.filter((tx) => tx.tripId)

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return
    if (!user) return

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
    })

    setIsCreateOpen(false)
    setNewTripName('')
    setNewTripDescription('')
    setNewTripStartDate('')
    setNewTripEndDate('')
    setNewTripMembers([])
  }

  const handleAddExpense = (tripId: string) => {
    setExpenseTripId(tripId)
    setIsAddExpenseOpen(true)
  }

  // Stats
  const totalLegacyExpenses = allTripTransactions.reduce(
    (sum, tx) => sum + (tx.currency === 'JPY' ? Math.abs(tx.amount) * 0.22 : Math.abs(tx.amount)),
    0
  )
  const totalNewExpenses = allTripExpenses.reduce(
    (sum, ex) => sum + (ex.currency === 'JPY' ? ex.totalAmount * 0.22 : ex.totalAmount),
    0
  )
  const totalTripExpenses = totalLegacyExpenses + totalNewExpenses
  const uniquePeople = new Set(
    [...activeTrips, ...closedTrips].flatMap((t) => t.members || [])
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Plane className="mx-auto size-8 animate-pulse text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading trips...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Trip / Event Mode
          </h1>
          <p className="text-muted-foreground">
            Create shared expense sessions for trips and events.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Trip</DialogTitle>
              <DialogDescription>
                Start a new shared expense session.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Trip Name</Label>
                <Input
                  placeholder="e.g., Phuket Weekend"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description / Destination</Label>
                <Input
                  placeholder="e.g., Phuket, Thailand"
                  value={newTripDescription}
                  onChange={(e) => setNewTripDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newTripStartDate}
                    onChange={(e) => setNewTripStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newTripEndDate}
                    onChange={(e) => setNewTripEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>สมาชิก</Label>
                <MemberPicker
                  value={newTripMembers}
                  onChange={setNewTripMembers}
                  selfUid={user?.uid}
                />
                <p className="text-xs text-muted-foreground">คุณจะถูกเพิ่มเป็นสมาชิกอัตโนมัติ</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTrip} disabled={!newTripName.trim()}>
                Create Trip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plane className="size-4" />
              Active Trips
            </div>
            <p className="mt-2 text-3xl font-bold">{activeTrips.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="size-4" />
              Total Trip Expenses
            </div>
            <p className="mt-2 text-3xl font-bold">
              ฿{totalTripExpenses.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              People Involved
            </div>
            <p className="mt-2 text-3xl font-bold">{uniquePeople.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Trips Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Plane className="size-4" />
            Active
            {activeTrips.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full">
                {activeTrips.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <Check className="size-4" />
            Completed
            {closedTrips.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full">
                {closedTrips.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activeTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  tripTransactions={getTransactionsForTrip(trip.id!)}
                  tripExpenses={allTripExpenses.filter((e) => e.tripId === trip.id)}
                  tripSettlements={allTripSettlements.filter((s) => s.tripId === trip.id)}
                  onDelete={removeTrip}
                  onClose={endTrip}
                  onAddExpense={handleAddExpense}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Plane className="size-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium">No active trips</p>
                <p className="text-sm text-muted-foreground">
                  Create a new trip to start tracking shared expenses
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Create Trip
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {closedTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {closedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  tripTransactions={getTransactionsForTrip(trip.id!)}
                  tripExpenses={allTripExpenses.filter((e) => e.tripId === trip.id)}
                  tripSettlements={allTripSettlements.filter((s) => s.tripId === trip.id)}
                  onDelete={removeTrip}
                  onClose={endTrip}
                  onAddExpense={handleAddExpense}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Check className="size-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium">No completed trips</p>
                <p className="text-sm text-muted-foreground">
                  Completed trips will appear here
                </p>
              </CardContent>
            </Card>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Trip Expense</DialogTitle>
            <DialogDescription>
              Add an expense to this trip. It will be split among all
              participants.
            </DialogDescription>
          </DialogHeader>
          <TripExpenseFormV2
            tripMembers={expenseMemberObjects}
            myUserId={user?.uid || ''}
            initialData={null}
            onSubmit={async (data) => {
              if (!expenseTripId || !user) return
              await addExpense({ ...data, tripId: expenseTripId, userId: user.uid })
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
    </div>
  )
}
