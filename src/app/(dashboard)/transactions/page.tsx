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

// Mock transaction data
const transactions = [
  {
    id: '1',
    date: '2024-06-15',
    description: 'Grab Food - Pad Thai',
    amount: -185,
    category: 'Food & Dining',
    payer: 'Me',
    notes: 'Lunch delivery',
    tags: ['delivery', 'thai'],
  },
  {
    id: '2',
    date: '2024-06-15',
    description: 'BTS Monthly Pass',
    amount: -1500,
    category: 'Transport',
    payer: 'Me',
    notes: 'June monthly pass',
    tags: ['subscription'],
  },
  {
    id: '3',
    date: '2024-06-14',
    description: 'Salary Deposit',
    amount: 55000,
    category: 'Income',
    payer: 'Company',
    notes: 'June salary',
    tags: ['salary'],
  },
  {
    id: '4',
    date: '2024-06-14',
    description: 'Central Department Store',
    amount: -2340,
    category: 'Shopping',
    payer: 'Me',
    notes: 'New shoes',
    tags: ['clothing'],
  },
  {
    id: '5',
    date: '2024-06-13',
    description: 'Netflix Subscription',
    amount: -419,
    category: 'Entertainment',
    payer: 'Me',
    notes: 'Monthly subscription',
    tags: ['subscription', 'streaming'],
  },
  {
    id: '6',
    date: '2024-06-13',
    description: 'Starbucks Coffee',
    amount: -175,
    category: 'Food & Dining',
    payer: 'Me',
    notes: 'Morning coffee',
    tags: ['coffee'],
  },
  {
    id: '7',
    date: '2024-06-12',
    description: 'Electric Bill',
    amount: -1850,
    category: 'Bills & Utilities',
    payer: 'Me',
    notes: 'May electricity',
    tags: ['utilities'],
  },
  {
    id: '8',
    date: '2024-06-12',
    description: 'Dinner with friends',
    amount: -890,
    category: 'Food & Dining',
    payer: 'Me',
    notes: 'Split bill at Sushi restaurant',
    tags: ['social', 'japanese'],
  },
  {
    id: '9',
    date: '2024-06-11',
    description: 'Freelance Payment',
    amount: 8500,
    category: 'Income',
    payer: 'Client',
    notes: 'Design project',
    tags: ['freelance'],
  },
  {
    id: '10',
    date: '2024-06-10',
    description: 'Gym Membership',
    amount: -1200,
    category: 'Health & Fitness',
    payer: 'Me',
    notes: 'Monthly gym fee',
    tags: ['subscription', 'fitness'],
  },
]

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
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('All Categories')
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [naturalInput, setNaturalInput] = React.useState('')
  const [parsedItems, setParsedItems] = React.useState<ParsedItem[]>([])
  const [showParsedDialog, setShowParsedDialog] = React.useState(false)

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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
      setSelectedRows(filteredTransactions.map((t) => t.id))
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
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
                <DialogDescription>
                  Enter the details for your new transaction.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" placeholder="Enter description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (฿)</Label>
                    <Input id="amount" type="number" placeholder="0" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.slice(1).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Add any notes..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input id="tags" placeholder="Comma-separated tags" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Transaction</Button>
              </DialogFooter>
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
              {filteredTransactions.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className={cn(
                    'group cursor-pointer',
                    selectedRows.includes(transaction.id) && 'bg-muted/50'
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(transaction.id)}
                      onCheckedChange={() => handleRowSelect(transaction.id)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(transaction.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                      {transaction.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">
                          {transaction.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
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
                  <TableCell className="text-muted-foreground">{transaction.payer}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      transaction.amount > 0 ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {transaction.amount > 0 ? '+' : ''}฿
                    {Math.abs(transaction.amount).toLocaleString()}
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
                        <DropdownMenuItem>
                          <Edit2 className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Tag className="mr-2 size-4" />
                          Add Tags
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
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
              +฿{transactions
                .filter((t) => t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Expenses</div>
            <div className="mt-1 text-2xl font-bold text-destructive">
              -฿{Math.abs(
                transactions
                  .filter((t) => t.amount < 0)
                  .reduce((sum, t) => sum + t.amount, 0)
              ).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Net Balance</div>
            <div className="mt-1 text-2xl font-bold">
              {transactions.reduce((sum, t) => sum + t.amount, 0) >= 0 ? '+' : ''}฿
              {transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
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
