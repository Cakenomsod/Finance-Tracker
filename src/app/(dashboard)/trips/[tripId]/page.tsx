'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Receipt, Users, Calendar, MapPin, ArrowRight,
  Plus, Edit2, Trash2, MoreHorizontal, Lock, Plane,
  BarChart3, DollarSign,
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
import { TripExpenseForm } from '@/components/trips/trip-expense-form'
import { MemberTagInput } from '@/components/trips/member-tag-input'
import { Transaction } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import { Search, Filter } from 'lucide-react'

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
  const [isEditTripOpen, setIsEditTripOpen] = React.useState(false)
  const [editingTx, setEditingTx] = React.useState<Transaction | null>(null)
  const [editTripMembers, setEditTripMembers] = React.useState<string[]>([])
  const [expenseSearch, setExpenseSearch] = React.useState('')
  const [expenseFilterPaidBy, setExpenseFilterPaidBy] = React.useState('all')

  const trip = trips.find((t) => t.id === tripId)
  const tripTxs = transactions.filter((tx) => tx.tripId === tripId)
  const loading = tripsLoading || txLoading

  // --- Calculations ---
  const totalExpenses = tripTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const members = trip?.members || []

  // FIXED: calculate each person's net balance based on splitWith per transaction
  const participants = React.useMemo(() => {
    const net: Record<string, number> = {}
    members.forEach((m) => { net[m] = 0 })

    tripTxs.forEach((tx) => {
      const amount = Math.abs(tx.amount)
      const payer = tx.paidBy || members[0]
      const split = tx.splitWith // null = solo, 'all' = everyone, 'Name' = specific

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

    return members.map((member) => {
      const paid = tripTxs.filter((tx) => tx.paidBy === member).reduce((s, tx) => s + Math.abs(tx.amount), 0)
      const initials = member.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)
      return { name: member, initials, paid, netBalance: Math.round(net[member] || 0) }
    })
  }, [tripTxs, members])

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
    tripTxs.filter((tx) => tx.amount < 0).forEach((tx) => {
      const cat = tx.category || 'Others'
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amount))
    })
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [tripTxs])

  // Per-person bar chart data
  const perPersonData = participants.map((p) => ({
    name: p.name,
    paid: p.paid,
    net: p.netBalance,
  }))

  const meParticipant = participants.find((p) => p.name.toLowerCase() === 'me')
  const myBalance = meParticipant ? meParticipant.netBalance : 0

  // Filtered expenses for the Expenses tab
  const filteredTripTxs = tripTxs.filter((tx) => {
    const matchSearch = !expenseSearch ||
      tx.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      tx.category?.toLowerCase().includes(expenseSearch.toLowerCase())
    const matchPaidBy = expenseFilterPaidBy === 'all' || tx.paidBy === expenseFilterPaidBy
    return matchSearch && matchPaidBy
  })

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
                    setEditTripMembers([...trip.members])
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
            <p className="mt-2 text-3xl font-bold">{tripTxs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="size-4" /> Shared Splits
            </div>
            <p className="mt-2 text-3xl font-bold">{tripTxs.filter(tx => tx.splitWith).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses" className="w-full">
        <TabsList>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="size-4" /> Expenses
            <Badge variant="secondary" className="ml-1 rounded-full">{tripTxs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="size-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2">
            <Users className="size-4" /> Settlements
          </TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All Expenses</CardTitle>
                  <CardDescription>{filteredTripTxs.length} / {tripTxs.length} transactions</CardDescription>
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
                      >{m}</button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tripTxs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  ยังไม่มีรายการ กดปุ่ม Add Expense เพื่อเพิ่ม
                </div>
              ) : filteredTripTxs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">ไม่พบรายการที่ค้นหา</div>
              ) : (
                <div className="space-y-3">
                  {filteredTripTxs.map((tx) => {
                    const txDate = tx.date?.seconds ? new Date(tx.date.seconds * 1000) : new Date()
                    const splitLabel = !tx.splitWith ? '🙋 Solo' : tx.splitWith === 'all' ? '👥 All' : `🤝 ${tx.splitWith}`
                    return (
                      <div key={tx.id} className="group flex items-center justify-between rounded-lg border p-4 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                            <Receipt className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              จ่ายโดย {tx.paidBy || 'Me'} · {tx.category} · {splitLabel} · {txDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">฿{Math.abs(tx.amount).toLocaleString()}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingTx(tx); setIsAddExpenseOpen(true) }}>
                                <Edit2 className="mr-2 size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => removeTransaction(tx.id!)}>
                                <Trash2 className="mr-2 size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
                      <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
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
                          <p className="font-medium">{p.name}</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Settlement Plan</CardTitle>
              <CardDescription>Minimum transfers to settle all balances</CardDescription>
            </CardHeader>
            <CardContent>
              {settlements.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {tripTxs.length === 0 ? 'No expenses yet' : 'Everyone is settled up! 🎉'}
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="text-xs bg-destructive/20 text-destructive">
                            {s.from.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <Avatar className="size-9">
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {s.to.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-2">
                          <p className="text-sm font-medium">{s.from} → {s.to}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold tabular-nums">฿{s.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Trip Dialog */}
      <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
        <DialogContent>
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

              await editTrip(trip.id!, {
                name,
                description,
                startDate: startStr ? Timestamp.fromDate(new Date(startStr)) : undefined,
                endDate: endStr ? Timestamp.fromDate(new Date(endStr)) : undefined,
                members: editTripMembers,
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
              <MemberTagInput
                value={editTripMembers}
                onChange={setEditTripMembers}
              />
              <p className="text-xs text-muted-foreground">ใช้ "Me" สำหรับตัวเอง</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditTripOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isAddExpenseOpen} onOpenChange={(open) => { setIsAddExpenseOpen(open); if (!open) setEditingTx(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Edit Expense' : 'Add Trip Expense'}</DialogTitle>
            <DialogDescription>
              {editingTx ? 'Edit this expense' : 'Add an expense to this trip'}
            </DialogDescription>
          </DialogHeader>
          <TripExpenseForm
            tripMembers={members}
            initialData={editingTx}
            onSubmit={async (data) => {
              if (editingTx) {
                await editTransaction(editingTx.id!, { ...data, tripId })
              } else {
                await addTransaction({ ...data, tripId })
              }
              setIsAddExpenseOpen(false)
              setEditingTx(null)
            }}
            onCancel={() => { setIsAddExpenseOpen(false); setEditingTx(null) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
