'use client'

import * as React from 'react'
import {
  Users,
  Plus,
  ArrowRight,
  Check,
  Clock,
  MoreHorizontal,
  Send,
  History,
  AlertCircle,
  ChevronRight,
  Wallet,
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

// Mock debt data
const debts = {
  youOwe: [
    {
      id: '1',
      person: 'Sarah Chen',
      initials: 'SC',
      amount: 1500,
      reason: 'Dinner at Italian restaurant',
      date: '2024-06-10',
      status: 'pending',
    },
    {
      id: '2',
      person: 'Mike Johnson',
      initials: 'MJ',
      amount: 1750,
      reason: 'Concert tickets',
      date: '2024-06-08',
      status: 'pending',
    },
  ],
  owedToYou: [
    {
      id: '3',
      person: 'Lisa Wang',
      initials: 'LW',
      amount: 2300,
      reason: 'Grocery shopping split',
      date: '2024-06-12',
      status: 'pending',
    },
    {
      id: '4',
      person: 'Tom Brown',
      initials: 'TB',
      amount: 800,
      reason: 'Uber ride share',
      date: '2024-06-11',
      status: 'partial',
      paid: 300,
    },
    {
      id: '5',
      person: 'Emily Davis',
      initials: 'ED',
      amount: 2700,
      reason: 'Weekend trip expenses',
      date: '2024-06-05',
      status: 'pending',
    },
  ],
}

const paymentHistory = [
  {
    id: '1',
    type: 'received',
    person: 'Alex Kim',
    amount: 450,
    date: '2024-06-14',
    description: 'Coffee run settlement',
  },
  {
    id: '2',
    type: 'paid',
    person: 'Rachel Green',
    amount: 1200,
    date: '2024-06-13',
    description: 'Birthday dinner',
  },
  {
    id: '3',
    type: 'received',
    person: 'Tom Brown',
    amount: 300,
    date: '2024-06-12',
    description: 'Partial payment - Uber',
  },
  {
    id: '4',
    type: 'paid',
    person: 'David Lee',
    amount: 850,
    date: '2024-06-10',
    description: 'Movie night expenses',
  },
]

function DebtCard({
  person,
  initials,
  amount,
  reason,
  date,
  status,
  paid,
  type,
}: {
  person: string
  initials: string
  amount: number
  reason: string
  date: string
  status: string
  paid?: number
  type: 'owe' | 'owed'
}) {
  const remaining = paid ? amount - paid : amount
  const progress = paid ? (paid / amount) * 100 : 0

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
              <p className="text-sm text-muted-foreground">{reason}</p>
            </div>
          </div>
          <div className="text-right">
            <p
              className={cn(
                'text-lg font-bold tabular-nums',
                type === 'owe' ? 'text-destructive' : 'text-primary'
              )}
            >
              {type === 'owe' ? '-' : '+'}฿{remaining.toLocaleString()}
            </p>
            <Badge
              variant="secondary"
              className={cn(
                'mt-1 text-xs',
                status === 'partial' && 'bg-warning/20 text-warning',
                status === 'pending' && 'bg-muted text-muted-foreground'
              )}
            >
              {status === 'partial' ? `Partial (฿${paid} paid)` : 'Pending'}
            </Badge>
          </div>
        </div>

        {status === 'partial' && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {new Date(date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {type === 'owe' ? (
              <Button size="sm" variant="outline">
                <Send className="mr-2 size-3" />
                Settle
              </Button>
            ) : (
              <Button size="sm" variant="outline">
                <Check className="mr-2 size-3" />
                Mark Paid
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Send Reminder</DropdownMenuItem>
                <DropdownMenuItem>Edit Details</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DebtsPage() {
  const totalOwed = debts.youOwe.reduce((sum, d) => sum + d.amount, 0)
  const totalOwedToYou = debts.owedToYou.reduce(
    (sum, d) => sum + d.amount - (d.paid || 0),
    0
  )
  const netBalance = totalOwedToYou - totalOwed

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
              {debts.youOwe.length} people
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
              {debts.owedToYou.length} people
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
          <Dialog>
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
                  Enter the details of the shared expense or loan.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select>
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
                  <Label>Person</Label>
                  <Input placeholder="Enter name" />
                </div>
                <div className="grid gap-2">
                  <Label>Amount (฿)</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Textarea placeholder="What was this for?" />
                </div>
              </div>
              <DialogFooter>
                <Button>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="mx-4 text-muted-foreground">or</span>
          <p className="text-sm text-muted-foreground">
            Type: &quot;I paid 500 for my girlfriend&quot;
          </p>
        </CardContent>
      </Card>

      {/* Debts Tabs */}
      <Tabs defaultValue="owed-to-you" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="owed-to-you" className="gap-2">
            <Wallet className="size-4" />
            Owed to You
            <Badge variant="secondary" className="ml-1 rounded-full">
              {debts.owedToYou.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="you-owe" className="gap-2">
            <AlertCircle className="size-4" />
            You Owe
            <Badge variant="secondary" className="ml-1 rounded-full">
              {debts.youOwe.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owed-to-you" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {debts.owedToYou.map((debt) => (
              <DebtCard key={debt.id} {...debt} type="owed" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="you-owe" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {debts.youOwe.map((debt) => (
              <DebtCard key={debt.id} {...debt} type="owe" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Settlement History</CardTitle>
              <CardDescription>Recent debt settlements and payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-full',
                          payment.type === 'received'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {payment.type === 'received' ? (
                          <ArrowRight className="size-4 rotate-180" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {payment.type === 'received' ? 'Received from' : 'Paid to'}{' '}
                          {payment.person}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-semibold tabular-nums',
                          payment.type === 'received' ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {payment.type === 'received' ? '+' : '-'}฿
                        {payment.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
