'use client'

import * as React from 'react'
import {
  Search,
  Filter,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Edit2,
  Trash2,
  ArrowUpDown,
  Download,
  Calendar,
  Tag,
  User,
  X,
  Loader2,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, amountColorClass } from '@/lib/utils'
import { getTransactionEffectiveAmount, getPaotangCapReasonLabel, isPaotangPayment, PAOTANG_GOV_PERCENT } from '@/lib/transaction-payment'
import { useWindowedTransactions } from '@/hooks/use-windowed-transactions'
import { useWindowedTripExpenses } from '@/hooks/use-windowed-trip-expenses'
import { useTransactions } from '@/hooks/use-transactions'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { useAuth } from '@/hooks/use-auth'
import { getTripExpensePersonalExpenseAmount, getTripExpenseUserShare, isTripExpensePendingDebt } from '@/lib/trip-balance'
import {
  mergeTransactions,
  filterByMonth,
  computeMonthTotals,
  collectMonthsWithData,
} from '@/lib/aggregate-transactions'
import { useCategories } from '@/hooks/use-categories'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionAiPanel, type TransactionAiPanelHandle } from '@/components/transactions/transaction-ai-panel'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import { MonthGroupDividerRow } from '@/components/transactions/month-group-divider'
import { MonthPicker } from '@/components/shared/month-picker'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  useMonthTransition,
} from '@/components/shared/month-transition'
import { TransactionMobileList } from '@/components/transactions/transaction-mobile-list'
import { TransactionDetailDialog } from '@/components/transactions/transaction-detail-dialog'
import { TripExpenseDialog } from '@/components/trips/trip-expense-dialog'
import { useTrips } from '@/hooks/use-trips'
import { Transaction, TripExpense } from '@/lib/firestore-types'
import {
  formatTransactionDisplayTime,
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  groupItemsByMonthAndDate,
  hasMonthData,
  toDateFromFirestore,
} from '@/lib/datetime'
import { shouldIgnoreRowClick } from '@/lib/row-click'
type TransactionsPageRow = {
  id: string | undefined
  description: string
  amount: number
  fullAmount: number
  amountThb: number
  category: string
  date: Transaction['date']
  paidBy: string
  isLegacy: boolean
  isPaotang: boolean
  paotangQuotaCapped?: boolean
  paotangCapReason?: Transaction['paotangCapReason']
  paotangSubsidy?: number | null
  rawTx: Transaction | null
  rawEx: TripExpense | null
  note?: string
  isTripDebtPending?: boolean
  expenseAmountThb?: number
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const {
    items: transactions,
    loading: txLoading,
    addTransaction,
    editTransaction,
    removeTransaction,
    loadOlder: loadOlderTransactions,
    loadingOlder: txLoadingOlder,
    hasMoreOlder: hasMoreOlderTx,
  } = useWindowedTransactions(user?.uid)
  const {
    items: allTripExpenses,
    loading: tripLoading,
    loadOlder: loadOlderTripExpenses,
    loadingOlder: tripLoadingOlder,
    hasMoreOlder: hasMoreOlderTrip,
  } = useWindowedTripExpenses(user?.uid)
  const { transactions: allTransactions } = useTransactions()
  const { allTripExpenses: fullTripExpenses } = useAllTripExpenses()
  const { categories } = useCategories()
  const { trips } = useTrips()

  const filterCategories = React.useMemo(
    () => ['All Categories', ...categories.map((c) => c.name)],
    [categories]
  )

  const categoryByName = React.useMemo(
    () => new Map(categories.map((c) => [c.name, c])),
    [categories]
  )
  
  const loading = txLoading || tripLoading
  const loadingOlder = txLoadingOlder || tripLoadingOlder
  const hasMoreOlder = hasMoreOlderTx || hasMoreOlderTrip

  const loadOlderInFlightRef = React.useRef(false)
  const hasMoreTxRef = React.useRef(hasMoreOlderTx)
  const hasMoreTripRef = React.useRef(hasMoreOlderTrip)

  React.useEffect(() => {
    hasMoreTxRef.current = hasMoreOlderTx
  }, [hasMoreOlderTx])

  React.useEffect(() => {
    hasMoreTripRef.current = hasMoreOlderTrip
  }, [hasMoreOlderTrip])

  const loadOlder = React.useCallback(async () => {
    if (loadOlderInFlightRef.current || loadingOlder) return

    loadOlderInFlightRef.current = true
    let added = 0

    try {
      while (added < 50) {
        const fetches: Promise<number>[] = []
        if (hasMoreTxRef.current) fetches.push(loadOlderTransactions())
        if (hasMoreTripRef.current) fetches.push(loadOlderTripExpenses())
        if (fetches.length === 0) break

        const results = await Promise.all(fetches)
        const roundAdded = results.reduce((sum, count) => sum + count, 0)
        if (roundAdded === 0) break
        added += roundAdded
      }
    } finally {
      loadOlderInFlightRef.current = false
    }
  }, [loadingOlder, loadOlderTransactions, loadOlderTripExpenses])

  const loadOlderSentinelRef = useInfiniteScroll(loadOlder, {
    enabled: hasMoreOlder && !loading && !loadingOlder,
  })

  const [selectedMonth, setSelectedMonth] = React.useState(getCurrentMonthSelection)
  const { monthKey, direction: monthDirection, onMonthChange } = useMonthTransition(selectedMonth)

  const handleSelectedMonthChange = React.useCallback(
    (next: typeof selectedMonth) => onMonthChange(next, setSelectedMonth),
    [onMonthChange]
  )

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('All Categories')
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [detailTransaction, setDetailTransaction] = React.useState<Transaction | null>(null)
  const [detailTripExpense, setDetailTripExpense] = React.useState<TripExpense | null>(null)
  const [viewingTripExpense, setViewingTripExpense] = React.useState<TripExpense | null>(null)
  const [isTripExpenseOpen, setIsTripExpenseOpen] = React.useState(false)

  const tripForViewingExpense = React.useMemo(
    () =>
      viewingTripExpense
        ? trips.find((trip) => trip.id === viewingTripExpense.tripId) ?? null
        : null,
    [trips, viewingTripExpense]
  )
  const [ocrDraft, setOcrDraft] = React.useState<Omit<Transaction, 'id' | 'createdAt' | 'userId'> | null>(null)
  const [pendingImmichAssetIds, setPendingImmichAssetIds] = React.useState<string[]>([])
  const transactionAiPanelRef = React.useRef<TransactionAiPanelHandle>(null)

  // Merge legacy transactions and trip expenses (trip rows show only the user's share)
  const allCombined = React.useMemo((): TransactionsPageRow[] => {
    const legacy = transactions
      .filter((tx) => !tx.tripExpenseId)
      .map((tx) => {
      const factor = tx.currency === 'JPY' ? 0.22 : 1
      const effectiveAmount = getTransactionEffectiveAmount(tx)
      return {
        id: tx.id!,
        description: tx.description,
        amount: effectiveAmount,
        fullAmount: tx.amount,
        amountThb: effectiveAmount * factor,
        category: tx.category,
        date: tx.date,
        paidBy: tx.paidBy || 'Me',
        isLegacy: true,
        isPaotang: isPaotangPayment(tx),
        paotangQuotaCapped: tx.paotangQuotaCapped,
        paotangCapReason: tx.paotangCapReason,
        paotangSubsidy: tx.paotangSubsidy,
        rawTx: tx,
        rawEx: null,
        note: tx.note,
      }
    })

    const newExps = allTripExpenses.flatMap((ex) => {
      const myShare = user ? getTripExpenseUserShare(ex, user.uid) : ex.totalAmount
      if (user && myShare <= 0) return []

      const factor = ex.currency === 'JPY' ? 0.22 : 1
      const payersStr = ex.payers.map((p) => p.displayName).join(', ')
      const personalExpense = user
        ? getTripExpensePersonalExpenseAmount(ex, user.uid)
        : ex.totalAmount
      const isPending = user ? isTripExpensePendingDebt(ex, user.uid) : false
      const personalAmount = -myShare
      return [{
        id: ex.id!,
        description: ex.description,
        amount: personalAmount,
        amountThb: personalAmount * factor,
        category: ex.category || 'Other',
        date: ex.date,
        paidBy: payersStr,
        isLegacy: false,
        isPaotang: false,
        paotangSubsidy: undefined,
        paotangQuotaCapped: false,
        paotangCapReason: undefined,
        fullAmount: -ex.totalAmount,
        rawTx: null,
        rawEx: ex,
        note: ex.note,
        isTripDebtPending: isPending,
        expenseAmountThb: -personalExpense * factor,
      }]
    })

    const combined = [...legacy, ...newExps]
    combined.sort((a, b) => {
      const dateA = a.date?.seconds || 0
      const dateB = b.date?.seconds || 0
      return dateB - dateA
    })
    return combined
  }, [transactions, allTripExpenses, user?.uid])

  const summaryCombined = React.useMemo(
    () => mergeTransactions(allTransactions, fullTripExpenses, user?.uid),
    [allTransactions, fullTripExpenses, user?.uid]
  )

  const monthsWithData = React.useMemo(
    () => collectMonthsWithData(summaryCombined),
    [summaryCombined]
  )

  React.useEffect(() => {
    if (monthsWithData.size === 0) return
    if (!hasMonthData(monthsWithData, selectedMonth)) {
      const latest = getLatestAvailableMonth(monthsWithData)
      if (latest) setSelectedMonth(latest)
    }
  }, [monthsWithData, selectedMonth])

  const summaryTotals = React.useMemo(() => {
    const monthTxs = filterByMonth(summaryCombined, selectedMonth.year, selectedMonth.month)
    return computeMonthTotals(monthTxs)
  }, [summaryCombined, selectedMonth])

  const filteredTransactions = allCombined.filter((t) => {
    const descMatches = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const noteMatches = t.note?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const catMatches = t.category?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const matchesSearch = descMatches || noteMatches || catMatches
    const matchesCategory =
      selectedCategory === 'All Categories' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== 'All Categories'
  const showLoadOlderHint =
    hasActiveFilters &&
    filteredTransactions.length === 0 &&
    allCombined.length > 0

  const monthGroupedTransactions = React.useMemo(
    () =>
      groupItemsByMonthAndDate(filteredTransactions, (transaction) =>
        toDateFromFirestore(transaction.date)
      ),
    [filteredTransactions]
  )

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedRows.length === filteredTransactions.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredTransactions.map((t) => t.id as string))
    }
  }

  const handleViewTransaction = (transaction: {
    isLegacy: boolean
    rawTx: Transaction | null
    rawEx: TripExpense | null
  }) => {
    if (transaction.isLegacy && transaction.rawTx) {
      setDetailTransaction(transaction.rawTx)
      setDetailTripExpense(null)
      setIsDetailOpen(true)
      return
    }
    if (transaction.rawEx) {
      const trip = trips.find((t) => t.id === transaction.rawEx!.tripId)
      if (trip) {
        setViewingTripExpense(transaction.rawEx)
        setIsTripExpenseOpen(true)
        return
      }
      setDetailTransaction(null)
      setDetailTripExpense(transaction.rawEx)
      setIsDetailOpen(true)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          View and manage all your financial transactions.
        </p>
      </div>

      <TransactionAiPanel
        ref={transactionAiPanelRef}
        onOpenDraftForm={(draft, immichIds) => {
          setOcrDraft(draft)
          setPendingImmichAssetIds(immichIds || [])
          setEditingTransaction(null)
          setIsAddDialogOpen(true)
        }}
      />

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {filterCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Calendar className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Date Range</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Today</DropdownMenuItem>
              <DropdownMenuItem>This Week</DropdownMenuItem>
              <DropdownMenuItem>This Month</DropdownMenuItem>
              <DropdownMenuItem>Last 3 Months</DropdownMenuItem>
              <DropdownMenuItem>Custom Range</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              setEditingTransaction(null)
              setOcrDraft(null)
              setPendingImmichAssetIds([])
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[680px] sm:p-6">
              <DialogHeader>
                <DialogTitle>
                  {editingTransaction ? 'Edit Transaction' : ocrDraft ? 'ตรวจสอบธุรกรรมจาก AI' : 'Add Transaction'}
                </DialogTitle>
                <DialogDescription>
                  {ocrDraft
                    ? 'ข้อมูลจาก Gemini — แก้ไขได้ก่อนกดบันทึก'
                    : 'Enter the details for your transaction.'}
                </DialogDescription>
              </DialogHeader>
              <TransactionForm
                key={editingTransaction?.id || (ocrDraft ? 'ocr-draft' : 'new')}
                initialData={editingTransaction || (ocrDraft as Transaction | null)}
                pendingImmichAssetIds={pendingImmichAssetIds}
                onSubmit={async (data) => {
                  if (editingTransaction) {
                    await editTransaction(editingTransaction.id!, data)
                  } else {
                    await addTransaction({ ...data, source: data.source || (ocrDraft ? 'ai' : 'manual') })
                  }
                  if (ocrDraft && !editingTransaction) {
                    transactionAiPanelRef.current?.completeActiveJob()
                  }
                  setIsAddDialogOpen(false)
                  setEditingTransaction(null)
                  setOcrDraft(null)
                  setPendingImmichAssetIds([])
                }}
                onCancel={() => {
                  setIsAddDialogOpen(false)
                  setEditingTransaction(null)
                  setOcrDraft(null)
                  setPendingImmichAssetIds([])
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Selected Actions */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2">
          <span className="text-sm text-muted-foreground">
            {selectedRows.length} selected
          </span>
          <Button variant="ghost" size="sm">
            <Tag className="mr-2 size-4" />
            Add Tags
          </Button>
          <Button variant="ghost" size="sm">
            <Edit2 className="mr-2 size-4" />
            Edit Category
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelectedRows([])}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Sticky summary — totals for selected month */}
      <div className="sticky top-0 z-20 -mx-6 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mb-3 flex justify-center">
          <MonthPicker
            value={selectedMonth}
            onChange={handleSelectedMonthChange}
            size="sm"
            monthsWithData={monthsWithData}
          />
        </div>
        <MonthContentTransition
          monthKey={monthKey}
          direction={monthDirection}
          className="grid gap-3 sm:grid-cols-3"
        >
          <Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '0ms' }}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Income</div>
              <MonthAnimatedValue valueKey={`${monthKey}-income`} className="mt-1 block text-xl font-bold text-success sm:text-2xl">
                +฿{summaryTotals.income.toLocaleString()}
              </MonthAnimatedValue>
            </CardContent>
          </Card>
          <Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '45ms' }}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Expenses</div>
              <MonthAnimatedValue valueKey={`${monthKey}-expenses`} className="mt-1 block text-xl font-bold text-destructive sm:text-2xl">
                -฿{summaryTotals.expenses.toLocaleString()}
              </MonthAnimatedValue>
            </CardContent>
          </Card>
          <Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '90ms' }}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Net Balance</div>
              <MonthAnimatedValue
                valueKey={`${monthKey}-net`}
                className={cn('mt-1 block text-xl font-bold sm:text-2xl', amountColorClass(summaryTotals.net, 'text-foreground'))}
              >
                {summaryTotals.net >= 0 ? '+' : ''}฿
                {Math.abs(summaryTotals.net).toLocaleString()}
              </MonthAnimatedValue>
            </CardContent>
          </Card>
        </MonthContentTransition>
      </div>

      <TransactionMobileList
        transactions={filteredTransactions}
        loading={loading}
        categoryByName={categoryByName}
        selectedRows={selectedRows}
        onRowSelect={handleRowSelect}
        onView={handleViewTransaction}
        onEdit={(tx) => {
          setEditingTransaction(tx)
          setIsAddDialogOpen(true)
        }}
        onDelete={(id, tx) => removeTransaction(id, tx)}
      />

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedRows.length === filteredTransactions.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[80px]">
                  <Button variant="ghost" size="sm" className="-ml-3 h-8">
                    Time
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="-mr-3 h-8">
                    Amount
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">Loading transactions...</TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="space-y-1">
                      <p>No transactions found.</p>
                      {showLoadOlderHint && (
                        <p className="text-xs text-muted-foreground">
                          ลองเลื่อนลงเพื่อโหลดรายการเพิ่ม หรือล้างตัวกรอง
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : monthGroupedTransactions.map((monthGroup) => (
                <React.Fragment key={monthGroup.monthKey}>
                  <MonthGroupDividerRow label={monthGroup.label} colSpan={7} />
                  {monthGroup.dateGroups.map((group) => (
                <React.Fragment key={group.dateKey}>
                  <DateGroupDividerRow label={group.label} colSpan={7} />
                  {group.items.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className={cn(
                    'group cursor-pointer',
                    selectedRows.includes(transaction.id!) && 'bg-muted/50'
                  )}
                  onClick={(e) => {
                    if (shouldIgnoreRowClick(e.target)) return
                    handleViewTransaction(transaction)
                  }}
                >
                  <TableCell>
                    <div data-row-click-ignore onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows.includes(transaction.id!)}
                        onCheckedChange={() => handleRowSelect(transaction.id!)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(() => {
                      const txDate = toDateFromFirestore(transaction.date)
                      if (!txDate) return ''
                      return (
                        <span className="block text-sm tabular-nums leading-none">
                          {formatTransactionDisplayTime(txDate)}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {transaction.description}
                        {transaction.isPaotang && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-chart-2/40 text-chart-2">
                            เป๋าตัง
                          </Badge>
                        )}
                        {!transaction.isLegacy && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {transaction.isTripDebtPending ? 'ค้างจ่ายทริป' : 'Trip Expense'}
                          </Badge>
                        )}
                      </p>
                      {transaction.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          📝 {transaction.note}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const cat = categoryByName.get(transaction.category)
                      return (
                        <Badge
                          variant="secondary"
                          className="font-normal"
                          style={
                            cat?.color
                              ? { backgroundColor: `${cat.color}20`, color: cat.color }
                              : undefined
                          }
                        >
                          {cat?.icon ? `${cat.icon} ` : ''}
                          {transaction.category}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{transaction.paidBy || 'Me'}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      transaction.isTripDebtPending
                        ? 'text-muted-foreground'
                        : amountColorClass(transaction.amount)
                    )}
                  >
                    {(() => {
                      const isJpy = transaction.rawTx?.currency === 'JPY' || transaction.rawEx?.currency === 'JPY'
                      const displayAmount = transaction.amount
                      const fullAmount = transaction.fullAmount ?? transaction.amount
                      return (
                        <>
                          <span className="block">
                            {displayAmount > 0 ? '+' : ''}{isJpy ? '¥' : '฿'}
                            {Math.abs(displayAmount).toLocaleString()}
                          </span>
                          {transaction.isPaotang && Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              เต็ม ฿{Math.abs(fullAmount).toLocaleString()}
                              {' · '}รัฐ {PAOTANG_GOV_PERCENT}% (ตามโควต้า)
                            </span>
                          )}
                          {!transaction.isLegacy && Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              เต็ม {isJpy ? '¥' : '฿'}{Math.abs(fullAmount).toLocaleString()}
                            </span>
                          )}
                          {transaction.isPaotang && transaction.paotangQuotaCapped && (
                            <span className="text-[10px] text-warning block font-normal">
                              โควต้าจำกัด — {getPaotangCapReasonLabel(transaction.paotangCapReason)}
                            </span>
                          )}
                          {transaction.isTripDebtPending && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              ยังไม่นับในรายจ่าย — จ่ายคืนในหน้าทริป
                            </span>
                          )}
                          {isJpy && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              ({displayAmount > 0 ? '+' : ''}฿{(Math.abs(displayAmount) * 0.22).toLocaleString()})
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transaction.isLegacy ? (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setEditingTransaction(transaction.rawTx!)
                              setIsAddDialogOpen(true)
                            }}>
                              <Edit2 className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => removeTransaction(transaction.id!, transaction.rawTx)}>
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem disabled>
                            Go to Trip to edit
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                  ))}
                </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div ref={loadOlderSentinelRef} className="flex h-12 items-center justify-center">
        {loadingOlder && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            กำลังโหลดรายการเพิ่ม...
          </div>
        )}
      </div>

      <TransactionDetailDialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
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

      <TripExpenseDialog
        open={isTripExpenseOpen}
        onOpenChange={(open) => {
          setIsTripExpenseOpen(open)
          if (!open) setViewingTripExpense(null)
        }}
        expense={viewingTripExpense}
        trip={tripForViewingExpense}
        myUserId={user?.uid || ''}
      />

      {/* Floating Add Button (Mobile) — above bottom nav */}
      <Button
        size="lg"
        onClick={() => setIsAddDialogOpen(true)}
        className="fixed right-4 z-40 size-14 rounded-full shadow-lg bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden"
        aria-label="Add transaction"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  )
}
