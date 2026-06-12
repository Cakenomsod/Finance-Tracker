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
import { useTransactions } from '@/hooks/use-transactions'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useAuth } from '@/hooks/use-auth'
import { getTripExpenseUserShare } from '@/lib/trip-balance'
import { useCategories } from '@/hooks/use-categories'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionAiPanel } from '@/components/transactions/transaction-ai-panel'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import { TransactionMobileList } from '@/components/transactions/transaction-mobile-list'
import { Transaction } from '@/lib/firestore-types'
import {
  formatTransactionDisplayTime,
  groupItemsByDate,
  toDateFromFirestore,
} from '@/lib/datetime'

export default function TransactionsPage() {
  const { user } = useAuth()
  const { transactions, loading: txLoading, addTransaction, editTransaction, removeTransaction } = useTransactions()
  const { allTripExpenses, loading: tripLoading } = useAllTripExpenses()
  const { categories } = useCategories()

  const filterCategories = React.useMemo(
    () => ['All Categories', ...categories.map((c) => c.name)],
    [categories]
  )

  const categoryByName = React.useMemo(
    () => new Map(categories.map((c) => [c.name, c])),
    [categories]
  )
  
  const loading = txLoading || tripLoading

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('All Categories')
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null)
  const [ocrDraft, setOcrDraft] = React.useState<Omit<Transaction, 'id' | 'createdAt' | 'userId'> | null>(null)
  const [pendingImmichAssetIds, setPendingImmichAssetIds] = React.useState<string[]>([])

  // Merge legacy transactions and trip expenses (trip rows show only the user's share)
  const allCombined = React.useMemo(() => {
    const legacy = transactions
      .filter((tx) => !tx.tripExpenseId)
      .map((tx) => {
      const factor = tx.currency === 'JPY' ? 0.22 : 1
      const effectiveAmount = getTransactionEffectiveAmount(tx)
      return {
        id: tx.id,
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
      const personalAmount = -myShare
      return [{
        id: ex.id,
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

  // Filter transactions
  const filteredTransactions = allCombined.filter((t) => {
    const descMatches = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const noteMatches = t.note?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const catMatches = t.category?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const matchesSearch = descMatches || noteMatches || catMatches
    const matchesCategory =
      selectedCategory === 'All Categories' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const groupedTransactions = React.useMemo(
    () =>
      groupItemsByDate(filteredTransactions, (transaction) =>
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
            <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-[680px]">
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
                existingTransactions={transactions}
                pendingImmichAssetIds={pendingImmichAssetIds}
                onSubmit={async (data) => {
                  if (editingTransaction) {
                    await editTransaction(editingTransaction.id!, data)
                  } else {
                    await addTransaction({ ...data, source: data.source || (ocrDraft ? 'ai' : 'manual') })
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

      <TransactionMobileList
        transactions={filteredTransactions}
        loading={loading}
        categoryByName={categoryByName}
        selectedRows={selectedRows}
        onRowSelect={handleRowSelect}
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
                  <TableCell colSpan={7} className="h-24 text-center">No transactions found.</TableCell>
                </TableRow>
              ) : groupedTransactions.map((group) => (
                <React.Fragment key={group.dateKey}>
                  <DateGroupDividerRow label={group.label} colSpan={7} />
                  {group.items.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className={cn(
                    'group cursor-pointer',
                    selectedRows.includes(transaction.id!) && 'bg-muted/50'
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(transaction.id!)}
                      onCheckedChange={() => handleRowSelect(transaction.id!)}
                    />
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
                          <Badge variant="outline" className="ml-2 text-[10px]">Trip Expense</Badge>
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
                      amountColorClass(transaction.amount)
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
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Income</div>
            <div className="mt-1 text-2xl font-bold text-success">
              +฿{allCombined
                .filter((t) => t.amountThb > 0)
                .reduce((sum, t) => sum + t.amountThb, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Expenses</div>
            <div className="mt-1 text-2xl font-bold text-destructive">
              -฿{Math.abs(
                allCombined
                  .filter((t) => t.amountThb < 0)
                  .reduce((sum, t) => sum + t.amountThb, 0)
              ).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Net Balance</div>
            <div className={cn('mt-1 text-2xl font-bold', amountColorClass(allCombined.reduce((sum, t) => sum + t.amountThb, 0), 'text-foreground'))}>
              {allCombined.reduce((sum, t) => sum + t.amountThb, 0) >= 0 ? '+' : ''}฿
              {allCombined.reduce((sum, t) => sum + t.amountThb, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

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
