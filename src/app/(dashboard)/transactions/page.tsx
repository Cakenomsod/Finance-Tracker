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
  Sparkles,
  Check,
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
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks/use-transactions'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Transaction } from '@/lib/firestore-types'

const categories = [
  'All Categories',
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Income',
]

const categoryColors: Record<string, string> = {
  'Food & Dining': 'bg-chart-1/20 text-chart-1',
  'Transport': 'bg-chart-2/20 text-chart-2',
  'Shopping': 'bg-chart-3/20 text-chart-3',
  'Entertainment': 'bg-chart-4/20 text-chart-4',
  'Bills & Utilities': 'bg-chart-5/20 text-chart-5',
  'Health & Fitness': 'bg-primary/20 text-primary',
  'Income': 'bg-primary/20 text-primary',
}

interface ParsedItem {
  name: string
  amount: number
  category: string
}

export default function TransactionsPage() {
  const { transactions, loading: txLoading, addTransaction, editTransaction, removeTransaction } = useTransactions()
  const { allTripExpenses, loading: tripLoading } = useAllTripExpenses()
  
  const loading = txLoading || tripLoading

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('All Categories')
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [naturalInput, setNaturalInput] = React.useState('')
  const [parsedItems, setParsedItems] = React.useState<ParsedItem[]>([])
  const [showParsedDialog, setShowParsedDialog] = React.useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null)

  // Merge legacy transactions and trip expenses
  const allCombined = React.useMemo(() => {
    const legacy = transactions.map(tx => {
      const factor = tx.currency === 'JPY' ? 0.22 : 1
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        amountThb: tx.amount * factor,
        category: tx.category,
        date: tx.date,
        paidBy: tx.paidBy || 'Me',
        isLegacy: true,
        rawTx: tx,
        rawEx: null
      }
    })

    const newExps = allTripExpenses.map(ex => {
      const factor = ex.currency === 'JPY' ? 0.22 : 1
      const payersStr = ex.payers.map(p => p.displayName).join(', ')
      return {
        id: ex.id,
        description: ex.description,
        amount: -ex.totalAmount, // Expenses are negative in transaction view
        amountThb: -ex.totalAmount * factor,
        category: ex.category || 'Other',
        date: ex.date,
        paidBy: payersStr,
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
  }, [transactions, allTripExpenses])

  // Filter transactions
  const filteredTransactions = allCombined.filter((t) => {
    const descMatches = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const catMatches = t.category?.toLowerCase().includes(searchQuery.toLowerCase()) || false
    const matchesSearch = descMatches || catMatches
    const matchesCategory =
      selectedCategory === 'All Categories' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Handle natural language input
  const handleNaturalInput = () => {
    if (!naturalInput.trim()) return

    // Simple parser for natural language input like "Fried rice 60 coffee 45 water 20"
    const regex = /([a-zA-Z\s]+)\s*(\d+)/g
    const items: ParsedItem[] = []
    let match

    while ((match = regex.exec(naturalInput)) !== null) {
      items.push({
        name: match[1].trim(),
        amount: parseInt(match[2], 10),
        category: 'Food & Dining', // Default category
      })
    }

    if (items.length > 0) {
      setParsedItems(items)
      setShowParsedDialog(true)
    }
  }

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

      {/* Natural Language Input */}
      <Card className="border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-sm font-medium">Quick Add with AI</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Type naturally: &quot;Fried rice 60 coffee 45 water 20&quot;"
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleNaturalInput()}
            />
            <Button onClick={handleNaturalInput}>Parse & Add</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            AI will automatically detect item names, amounts, and categories
          </p>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
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
              {categories.map((category) => (
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
            if (!open) setEditingTransaction(null)
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
                <DialogDescription>
                  Enter the details for your transaction.
                </DialogDescription>
              </DialogHeader>
              <TransactionForm 
                initialData={editingTransaction}
                onSubmit={async (data) => {
                  if (editingTransaction) {
                    await editTransaction(editingTransaction.id!, data)
                  } else {
                    await addTransaction(data)
                  }
                  setIsAddDialogOpen(false)
                  setEditingTransaction(null)
                }}
                onCancel={() => {
                  setIsAddDialogOpen(false)
                  setEditingTransaction(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Selected Actions */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
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

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedRows.length === filteredTransactions.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[100px]">
                  <Button variant="ghost" size="sm" className="-ml-3 h-8">
                    Date
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
              ) : filteredTransactions.map((transaction) => (
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
                    {transaction.date ? new Date(transaction.date.seconds * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    }) : ''}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {transaction.description}
                        {!transaction.isLegacy && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Trip Expense</Badge>
                        )}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'font-normal',
                        categoryColors[transaction.category] || 'bg-muted'
                      )}
                    >
                      {transaction.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{transaction.paidBy || 'Me'}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      transaction.amount > 0 ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {(() => {
                      const isJpy = transaction.rawTx?.currency === 'JPY' || transaction.rawEx?.currency === 'JPY'
                      return (
                        <>
                          <span className="block">
                            {transaction.amount > 0 ? '+' : ''}{isJpy ? '¥' : '฿'}
                            {Math.abs(transaction.amount).toLocaleString()}
                          </span>
                          {isJpy && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              ({transaction.amount > 0 ? '+' : ''}฿{(Math.abs(transaction.amount) * 0.22).toLocaleString()})
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
                            <DropdownMenuItem className="text-destructive" onClick={() => removeTransaction(transaction.id!)}>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Income</div>
            <div className="mt-1 text-2xl font-bold text-primary">
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
            <div className="mt-1 text-2xl font-bold">
              {allCombined.reduce((sum, t) => sum + t.amountThb, 0) >= 0 ? '+' : ''}฿
              {allCombined.reduce((sum, t) => sum + t.amountThb, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parsed Items Dialog */}
      <Dialog open={showParsedDialog} onOpenChange={setShowParsedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Parsed Items</DialogTitle>
            <DialogDescription>
              Review the items parsed from your input before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {parsedItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <Check className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                </div>
                <span className="font-semibold tabular-nums">฿{item.amount}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold">
                ฿{parsedItems.reduce((sum, item) => sum + item.amount, 0)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParsedDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowParsedDialog(false)
                setNaturalInput('')
                setParsedItems([])
              }}
            >
              Save All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Add Button (Mobile) */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  )
}
