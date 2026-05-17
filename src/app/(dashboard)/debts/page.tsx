'use client'

import * as React from 'react'
import {
  Users,
  Plus,
  ArrowRight,
  Check,
  History,
  AlertCircle,
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDebts } from '@/hooks/use-debts'
import { useTripDebts } from '@/hooks/use-trip-debts'
import { useAuth } from '@/hooks/use-auth'
import { Debt } from '@/lib/firestore-types'
import { createTripSettlement } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'

interface UIGlobalDebt extends Omit<Debt, 'createdAt'> {
  fromDisplayName?: string
  toDisplayName?: string
  isTripDebt?: boolean
  tripIds?: string[]
  createdAt?: any
}

function DebtCard({
  debt,
  type,
  person,
  onSettle,
  onDelete,
}: {
  debt: UIGlobalDebt
  type: 'owe' | 'owed'
  person: string
  onSettle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const initials = person.substring(0, 2).toUpperCase()
  const date = debt.createdAt ? new Date(debt.createdAt.seconds * 1000) : new Date()

  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback
                className={cn(
                  'text-sm font-medium',
                  type === 'owe'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-primary/20 text-primary'
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{person}</p>
              <p className="text-sm text-muted-foreground">
                {debt.isTripDebt ? 'From Trips' : debt.relatedTxIds?.length > 0 ? 'From transaction split' : 'Manual debt'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className={cn(
                'text-lg font-bold tabular-nums',
                type === 'owe' ? 'text-destructive' : 'text-primary'
              )}
            >
              {type === 'owe' ? '-' : '+'}฿{debt.amount.toLocaleString()}
            </p>
            <Badge
              variant="secondary"
              className={cn(
                'mt-1 text-xs',
                debt.status === 'pending' && 'bg-warning/20 text-warning',
                debt.status === 'settled' && 'bg-primary/20 text-primary'
              )}
            >
              {debt.status === 'pending' ? 'Pending' : 'Settled'}
            </Badge>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {debt.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => onSettle(debt.id!)}>
                {type === 'owe' ? (
                  <>
                    <Send className="mr-2 size-3" />
                    Settle
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-3" />
                    Mark Paid
                  </>
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {debt.isTripDebt ? (
                  <DropdownMenuItem disabled>
                    Auto-generated from trips
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(debt.id!)}>
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DebtsPage() {
  const { user } = useAuth()
  const { debts, loading, addDebt, settleDebt, removeDebt } = useDebts()
  const { tripDebts, loading: tripLoading } = useTripDebts()

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newDebtType, setNewDebtType] = React.useState<'owe' | 'owed'>('owe')
  const [newDebtPerson, setNewDebtPerson] = React.useState('')
  const [newDebtAmount, setNewDebtAmount] = React.useState('')

  if (loading || tripLoading) {
    return <div className="p-6">Loading debts...</div>
  }

  // Map manual debts
  const manualPending = debts.filter(d => d.status === 'pending').map(d => ({ ...d } as UIGlobalDebt))
  
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
  const settledDebts = debts.filter(d => d.status === 'settled')

  const youOwe = allPending.filter((d) => d.fromUserId === user?.uid)
  const owedToYou = allPending.filter((d) => d.toUserId === user?.uid)

  const totalOwed = youOwe.reduce((sum, d) => sum + d.amount, 0)
  const totalOwedToYou = owedToYou.reduce((sum, d) => sum + d.amount, 0)
  
  const netBalance = totalOwedToYou - totalOwed

  const handleSettle = async (id: string) => {
    const debt = allPending.find(d => d.id === id)
    if (!debt) return
    
    if (debt.isTripDebt) {
      // Create a cross-trip settlement
      await createTripSettlement({
        userId: user!.uid,
        fromUserId: debt.fromUserId,
        fromDisplayName: debt.fromDisplayName || debt.fromUserId,
        toUserId: debt.toUserId,
        toDisplayName: debt.toDisplayName || debt.toUserId,
        amount: debt.amount,
        isPartial: false,
        date: Timestamp.now(),
      })
    } else {
      await settleDebt(id)
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Debts & Shared Expenses</h1>
        <p className="text-muted-foreground">
          Track money you owe and money owed to you.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4 text-destructive" />
              You Owe
            </div>
            <p className="mt-2 text-3xl font-bold text-destructive">
              ฿{totalOwed.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {youOwe.length} active debts
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4 text-primary" />
              Owed to You
            </div>
            <p className="mt-2 text-3xl font-bold text-primary">
              ฿{totalOwedToYou.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {owedToYou.length} active debts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              Net Balance
            </div>
            <p
              className={cn(
                'mt-2 text-3xl font-bold',
                netBalance >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {netBalance >= 0 ? '+' : ''}฿{netBalance.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {netBalance >= 0 ? 'In your favor' : 'In their favor'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Debt */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-6">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" />
                Record New Debt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Debt</DialogTitle>
                <DialogDescription>
                  Enter the details of the manual loan.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={newDebtType} onValueChange={(v: 'owe' | 'owed') => setNewDebtType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owe">I owe someone</SelectItem>
                      <SelectItem value="owed">Someone owes me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Person Name</Label>
                  <Input 
                    placeholder="Enter name" 
                    value={newDebtPerson} 
                    onChange={e => setNewDebtPerson(e.target.value)} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Amount (฿)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={newDebtAmount} 
                    onChange={e => setNewDebtAmount(e.target.value)} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddDebt}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Debts Tabs */}
      <Tabs defaultValue="owed-to-you" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="owed-to-you" className="gap-2">
            <Wallet className="size-4" />
            Owed to You
            <Badge variant="secondary" className="ml-1 rounded-full">
              {owedToYou.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="you-owe" className="gap-2">
            <AlertCircle className="size-4" />
            You Owe
            <Badge variant="secondary" className="ml-1 rounded-full">
              {youOwe.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owed-to-you" className="mt-4">
          {owedToYou.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No one owes you money right now.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {owedToYou.map((debt) => (
                <DebtCard 
                  key={debt.id} 
                  debt={debt} 
                  type="owed" 
                  person={debt.fromDisplayName || debt.fromUserId} 
                  onSettle={handleSettle} 
                  onDelete={removeDebt} 
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="you-owe" className="mt-4">
          {youOwe.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">You don't owe anyone money right now.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {youOwe.map((debt) => (
                <DebtCard 
                  key={debt.id} 
                  debt={debt} 
                  type="owe" 
                  person={debt.toDisplayName || debt.toUserId} 
                  onSettle={handleSettle} 
                  onDelete={removeDebt} 
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Settlement History</CardTitle>
              <CardDescription>Recent debt settlements and payments</CardDescription>
            </CardHeader>
            <CardContent>
              {settledDebts.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">No settlement history found.</div>
              ) : (
                <div className="space-y-4">
                  {settledDebts.map((payment) => {
                    const isReceived = payment.toUserId === user?.uid
                    const person = isReceived ? payment.fromUserId : payment.toUserId
                    const date = payment.settledAt ? new Date(payment.settledAt.seconds * 1000) : new Date()
                    
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex size-10 items-center justify-center rounded-full',
                              isReceived
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {isReceived ? (
                              <ArrowRight className="size-4 rotate-180" />
                            ) : (
                              <ArrowRight className="size-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {isReceived ? 'Received from' : 'Paid to'}{' '}
                              {person}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Settled Debt
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              'font-semibold tabular-nums',
                              isReceived ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {isReceived ? '+' : '-'}฿
                            {payment.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
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
      </Tabs>
    </div>
  )
}
