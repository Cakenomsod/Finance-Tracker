'use client'

import * as React from 'react'
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
  X,
  Edit2,
  Trash2,
  UserPlus,
  DollarSign,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
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

// Mock trip data
const trips = [
  {
    id: '1',
    name: 'Phuket Weekend',
    destination: 'Phuket, Thailand',
    startDate: '2024-06-20',
    endDate: '2024-06-23',
    status: 'active',
    totalExpenses: 15800,
    participants: [
      { name: 'Me', initials: 'ME', paid: 8500, share: 3950 },
      { name: 'Sarah', initials: 'SC', paid: 3500, share: 3950 },
      { name: 'Mike', initials: 'MJ', paid: 2800, share: 3950 },
      { name: 'Lisa', initials: 'LW', paid: 1000, share: 3950 },
    ],
    expenses: [
      { id: '1', description: 'Hotel (3 nights)', amount: 6500, payer: 'Me', split: 'equal' },
      { id: '2', description: 'Flight tickets', amount: 4800, payer: 'Me', split: 'equal' },
      { id: '3', description: 'Dinner Day 1', amount: 1800, payer: 'Sarah', split: 'equal' },
      { id: '4', description: 'Activities', amount: 1700, payer: 'Sarah', split: 'equal' },
      { id: '5', description: 'Taxi rides', amount: 1000, payer: 'Lisa', split: 'equal' },
    ],
  },
  {
    id: '2',
    name: 'Birthday Dinner',
    destination: 'Bangkok',
    startDate: '2024-06-15',
    endDate: '2024-06-15',
    status: 'completed',
    totalExpenses: 4500,
    participants: [
      { name: 'Me', initials: 'ME', paid: 4500, share: 1500 },
      { name: 'Tom', initials: 'TB', paid: 0, share: 1500 },
      { name: 'Emily', initials: 'ED', paid: 0, share: 1500 },
    ],
    expenses: [
      { id: '1', description: 'Restaurant bill', amount: 3800, payer: 'Me', split: 'equal' },
      { id: '2', description: 'Birthday cake', amount: 700, payer: 'Me', split: 'equal' },
    ],
  },
]

interface Settlement {
  from: string
  to: string
  amount: number
}

function calculateSettlements(participants: typeof trips[0]['participants']): Settlement[] {
  const settlements: Settlement[] = []
  const balances = participants.map((p) => ({
    name: p.name,
    balance: p.paid - p.share,
  }))

  const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance)
  const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance)

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

function TripCard({ trip }: { trip: typeof trips[0] }) {
  const settlements = calculateSettlements(trip.participants)
  const myBalance = trip.participants.find((p) => p.name === 'Me')
  const myNetBalance = myBalance ? myBalance.paid - myBalance.share : 0

  return (
    <Card className="overflow-hidden">
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
                {trip.status === 'active' ? 'Active' : 'Completed'}
              </Badge>
            </div>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="size-3" />
              {trip.destination}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit2 className="mr-2 size-4" />
                Edit Trip
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus className="mr-2 size-4" />
                Add Participant
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 size-4" />
                Delete Trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-3" />
          {new Date(trip.startDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
          {trip.startDate !== trip.endDate && (
            <>
              {' - '}
              {new Date(trip.endDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Total and Balance */}
        <div className="flex items-center justify-between rounded-lg bg-muted p-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold">฿{trip.totalExpenses.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Your Balance</p>
            <p
              className={cn(
                'text-xl font-bold',
                myNetBalance > 0 ? 'text-primary' : myNetBalance < 0 ? 'text-destructive' : ''
              )}
            >
              {myNetBalance > 0 ? '+' : ''}฿{myNetBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Participants */}
        <div>
          <p className="text-sm font-medium mb-2">Participants</p>
          <div className="flex -space-x-2">
            {trip.participants.map((participant) => (
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
                    <span className="font-medium">{settlement.from}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="font-medium">{settlement.to}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    ฿{settlement.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Receipt className="mr-2 size-4" />
            Add Expense
          </Button>
          <Button size="sm" className="flex-1">
            <Calculator className="mr-2 size-4" />
            View Split
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TripsPage() {
  const activeTrips = trips.filter((t) => t.status === 'active')
  const completedTrips = trips.filter((t) => t.status === 'completed')

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trip / Event Mode</h1>
          <p className="text-muted-foreground">
            Create shared expense sessions for trips and events.
          </p>
        </div>
        <Dialog>
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
                <Input placeholder="e.g., Phuket Weekend" />
              </div>
              <div className="grid gap-2">
                <Label>Destination</Label>
                <Input placeholder="e.g., Phuket, Thailand" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Input type="date" />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Participants</Label>
                <Textarea placeholder="Enter names, one per line" />
              </div>
            </div>
            <DialogFooter>
              <Button>Create Trip</Button>
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
              Total This Month
            </div>
            <p className="mt-2 text-3xl font-bold">
              ฿{trips.reduce((sum, t) => sum + t.totalExpenses, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              People Involved
            </div>
            <p className="mt-2 text-3xl font-bold">
              {new Set(trips.flatMap((t) => t.participants.map((p) => p.name))).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trips */}
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
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activeTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
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
                <Button className="mt-4 gap-2">
                  <Plus className="size-4" />
                  Create Trip
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedTrips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {completedTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
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

      {/* Active Trip Detail (if any) */}
      {activeTrips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown - {activeTrips[0].name}</CardTitle>
            <CardDescription>All expenses for this trip</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTrips[0].expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Receipt className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Paid by {expense.payer} • Split {expense.split}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums">
                    ฿{expense.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Per Person Summary */}
            <div className="mt-6 border-t pt-4">
              <p className="text-sm font-medium mb-3">Per Person Summary</p>
              <div className="space-y-3">
                {activeTrips[0].participants.map((participant) => (
                  <div
                    key={participant.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {participant.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{participant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Paid: ฿{participant.paid.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Share: ฿{participant.share.toLocaleString()}
                      </p>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          participant.paid - participant.share > 0
                            ? 'text-primary'
                            : participant.paid - participant.share < 0
                            ? 'text-destructive'
                            : ''
                        )}
                      >
                        {participant.paid - participant.share > 0 ? '+' : ''}฿
                        {(participant.paid - participant.share).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
