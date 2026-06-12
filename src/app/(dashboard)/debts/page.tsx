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
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDebts } from '@/hooks/use-debts'
import { useTripDebts } from '@/hooks/use-trip-debts'
import { useTripSettlements } from '@/hooks/use-trip-settlements'
import { useTransactions } from '@/hooks/use-transactions'
import { allocateSettlementAcrossTrips } from '@/lib/trip-balance'
import { useAuth } from '@/hooks/use-auth'
import { Debt, Transaction, TripSettlement } from '@/lib/firestore-types'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import { createTripSettlement } from '@/lib/firestore'
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

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>รายการ</TableHead>
              <TableHead className="w-[140px]">{type === 'owe' ? 'เจ้าหนี้' : 'ลูกหนี้'}</TableHead>
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
                  className={cn('group', canViewTx && 'cursor-pointer')}
                  onClick={() => {
                    if (canViewTx) onViewTransaction(relatedTxId)
                  }}
                >
                  <TableCell>
                    <p className="max-w-[280px] truncate font-medium" title={itemLabel}>
                      {itemLabel}
                    </p>
                    {debtDate && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatTransactionDisplayTime(debtDate)}
                      </p>
                    )}
                    {debt.paidAmount && debt.paidAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        จ่ายแล้ว ฿{debt.paidAmount.toLocaleString()}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback
                          className={cn(
                            'text-[10px] font-medium',
                            type === 'owe'
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-success/20 text-success'
                          )}
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
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      type === 'owe' ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {type === 'owe' ? '-' : '+'}฿
                    {debt.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {debt.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSettle(debt.id!)
                          }}
                        >
                          {type === 'owe' ? (
                            <>
                              <Send className="mr-1.5 size-3" />
                              จ่ายคืน
                            </>
                          ) : (
                            <>
                              <Check className="mr-1.5 size-3" />
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
                            className="size-8"
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
                              {debt.isTripDebt ? 'สร้างอัตโนมัติจากทริป' : 'สร้างอัตโนมัติจากธุรกรรม'}
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
  )
}

export default function DebtsPage() {
  const { user } = useAuth()
  const { debts, loading, addDebt, settleDebt, removeDebt } = useDebts()
  const { tripDebts, tripBalanceData, loading: tripLoading } = useTripDebts()
  const { settlements: paymentSettlements, loading: settlementsLoading } = useTripSettlements()
  const { transactions, editTransaction } = useTransactions()

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

  if (loading || tripLoading || settlementsLoading) {
    return <div className="p-6">Loading debts...</div>
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
    setIsSettleOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settleDebtData) return

    const payAmount = parseFloat(settleAmount)
    if (!payAmount || payAmount <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง')
      return
    }
    if (payAmount > settleDebtData.amount) {
      toast.error('จำนวนเงินเกินยอดคงเหลือ')
      return
    }

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
      } else {
        await settleDebt(settleDebtData.id!, payAmount)
      }

      const isPartial = payAmount < settleDebtData.amount - 0.001
      toast.success(isPartial ? 'บันทึกการจ่ายบางส่วนแล้ว' : 'ชำระครบแล้ว')
      setIsSettleOpen(false)
      setSettleDebtData(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกการชำระไม่สำเร็จ')
    }
  }

  const handleViewTransaction = (txId: string) => {
    const tx = txById.get(txId)
    if (!tx) return
    setEditingTransaction(tx)
    setIsTxDetailOpen(true)
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
      <Tabs defaultValue="you-owe" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="you-owe" className="gap-2">
              <AlertCircle className="size-4" />
              You Owe
              <Badge variant="secondary" className="ml-1 rounded-full">
                {youOwe.length}
              </Badge>
            </TabsTrigger>
          <TabsTrigger value="owed-to-you" className="gap-2">
            <Wallet className="size-4" />
            Owed to You
            <Badge variant="secondary" className="ml-1 rounded-full">
              {owedToYou.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            ประวัติการจ่ายคืน
            <Badge variant="secondary" className="ml-1 rounded-full">
              {paymentHistory.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="you-owe" className="mt-4">
          {youOwe.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">คุณยังไม่ติดใคร</div>
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

        <TabsContent value="owed-to-you" className="mt-4">
          {owedToYou.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">ยังไม่มีใครติดเงินคุณ</div>
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

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการจ่ายคืน</CardTitle>
              <CardDescription>รายการจ่ายคืนทั้งหมด รวมทริปและหนี้ทั่วไป</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {paymentHistory.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground">ยังไม่มีประวัติการจ่ายคืน</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">รายการ</TableHead>
                      <TableHead>คู่รายการ</TableHead>
                      <TableHead className="w-[90px]">แหล่ง</TableHead>
                      <TableHead className="pr-6 text-right">จำนวนเงิน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedPaymentHistory.map((group) => (
                      <React.Fragment key={group.dateKey}>
                        <DateGroupDividerRow label={group.label} colSpan={4} />
                        {group.items.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="max-w-[240px] pl-6 truncate font-medium" title={payment.label}>
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
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {payment.isReceived ? (
                                  <ArrowRight className="size-3.5 rotate-180" />
                                ) : (
                                  <ArrowRight className="size-3.5" />
                                )}
                              </div>
                              <span>
                                {payment.isReceived ? 'รับจาก' : 'จ่ายให้'} {payment.person}
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
                              payment.isReceived ? 'text-success' : 'text-destructive'
                            )}
                          >
                            {payment.isReceived ? '+' : '-'}฿{payment.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isTxDetailOpen}
        onOpenChange={(open) => {
          setIsTxDetailOpen(open)
          if (!open) setEditingTransaction(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]">
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
              existingTransactions={transactions}
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

      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {settleDebtData?.fromUserId === user?.uid ? 'จ่ายคืน' : 'รับเงินคืน'}
            </DialogTitle>
            <DialogDescription>
              {settleDebtData && (
                <>
                  {settleDebtData.fromUserId === user?.uid ? 'จ่ายให้' : 'รับจาก'}{' '}
                  <span className="font-medium text-foreground">
                    {settleDebtData.fromUserId === user?.uid
                      ? settleDebtData.toDisplayName || settleDebtData.toUserId
                      : settleDebtData.fromDisplayName || settleDebtData.fromUserId}
                  </span>
                  {' — '}
                  {resolveDebtDescription(settleDebtData, txById)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {settleDebtData && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>จำนวนที่จ่าย (฿)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ฿
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={settleDebtData.amount}
                    className="pl-8 text-lg font-bold"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  ยอดคงเหลือ ฿{settleDebtData.amount.toLocaleString()} — สามารถจ่ายบางส่วนได้
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSettleAmount(settleDebtData.amount.toString())}
                >
                  จ่ายเต็มจำนวน
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSettleAmount((settleDebtData.amount / 2).toFixed(2))
                  }
                >
                  จ่ายครึ่งหนึ่ง
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettleOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleConfirmSettle}>ยืนยัน</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
