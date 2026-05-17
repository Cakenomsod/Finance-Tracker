import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Transaction } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import { useTrips } from '@/hooks/use-trips'

const formSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(1, 'Description is required'),
  date: z.string(),
  paidBy: z.string().optional(),
  splitWith: z.string().optional(),
  tripId: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof formSchema>

interface TransactionFormProps {
  initialData?: Transaction | null;
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onCancel: () => void;
}

export function TransactionForm({ initialData, onSubmit, onCancel }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { activeTrips } = useTrips()

  const [inputMode, setInputMode] = React.useState<'standard' | 'receipt'>(
    initialData?.items && initialData.items.length > 0 ? 'receipt' : 'standard'
  )

  interface ReceiptItemInput {
    name: string
    category: string
    price: string
    tax: string
  }

  const [receiptItems, setReceiptItems] = React.useState<ReceiptItemInput[]>(
    initialData?.items?.map(item => ({
      name: item.name,
      category: item.category,
      price: String(item.price),
      tax: String(item.tax)
    })) || [
      { name: '', category: 'Food & Dining', price: '', tax: '' }
    ]
  )

  const defaultDate = initialData?.date?.seconds
    ? new Date(initialData.date.seconds * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initialData ? Math.abs(initialData.amount).toString() : '',
      type: initialData?.type || 'expense',
      category: initialData?.category || '',
      description: initialData?.description || '',
      date: defaultDate,
      paidBy: initialData?.paidBy || 'Me',
      splitWith: initialData?.splitWith || '',
      tripId: initialData?.tripId || 'none',
    },
  })

  const isReceiptActive = inputMode === 'receipt' && receiptItems.some(item => (parseFloat(item.price) || 0) > 0)
  
  let calculatedTotal = 0
  let totalBase = 0
  let totalTax = 0
  if (isReceiptActive) {
    receiptItems.forEach(item => {
      const p = parseFloat(item.price) || 0
      const t = parseFloat(item.tax) || 0
      totalBase += p
      totalTax += t
      calculatedTotal += (p + t)
    })
  }

  const handleSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true)
    try {
      const rawAmount = isReceiptActive ? calculatedTotal : parseFloat(values.amount)
      
      if (isNaN(rawAmount) || rawAmount <= 0) {
        form.setError('amount', { message: 'Amount must be a positive number' })
        return
      }

      const finalAmount = values.type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount)
      
      const transactionData: any = {
        amount: finalAmount,
        type: values.type,
        category: isReceiptActive ? (receiptItems[0]?.category || values.category) : values.category,
        description: values.description,
        date: Timestamp.fromDate(new Date(values.date)),
        paidBy: values.paidBy || 'Me',
        splitWith: values.splitWith || null,
        tripId: values.tripId && values.tripId !== 'none' ? values.tripId : null,
        receiptUrl: initialData?.receiptUrl || null,
        source: initialData?.source || 'manual',
      }

      if (isReceiptActive) {
        transactionData.items = receiptItems.map(item => ({
          name: item.name || 'Item',
          category: item.category,
          price: parseFloat(item.price) || 0,
          tax: parseFloat(item.tax) || 0,
          splitWith: []
        }))
        transactionData.baseAmount = totalBase
        transactionData.taxAmount = totalTax
      }

      await onSubmit(transactionData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = [
    'Food & Dining',
    'Transport',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Health & Fitness',
    'Income',
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        {/* Input Mode Selector */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode('standard')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              inputMode === 'standard' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Standard Input
          </button>
          <button
            type="button"
            onClick={() => setInputMode('receipt')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              inputMode === 'receipt' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🧾 Receipt Input
          </button>
        </div>

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter details about this transaction" 
                  className="resize-none"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (฿)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    disabled={isReceiptActive}
                    value={isReceiptActive ? calculatedTotal.toFixed(2) : field.value}
                    onChange={field.onChange} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="paidBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid By</FormLabel>
                <FormControl>
                  <Input placeholder="Me or Friend's name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="splitWith"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Split With</FormLabel>
                <FormControl>
                  <Input placeholder="Friend's name (optional)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {activeTrips.length > 0 && (
          <FormField
            control={form.control}
            name="tripId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trip (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="No trip" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No trip</SelectItem>
                    {activeTrips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id!}>
                        {trip.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Receipt Items (Only in Receipt Mode) */}
        {inputMode === 'receipt' && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Items</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReceiptItems([...receiptItems, { name: '', category: 'Food & Dining', price: '', tax: '' }])}
                className="h-7 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Product
              </Button>
            </div>

            <div className="space-y-3">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Product Name (e.g. Pizza)"
                      className="flex-1 h-8 text-xs"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx].name = e.target.value
                        setReceiptItems(next)
                      }}
                    />
                    <Select
                      value={item.category}
                      onValueChange={val => {
                        const next = [...receiptItems]
                        next[idx].category = val
                        setReceiptItems(next)
                      }}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    {receiptItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      >
                        <Minus className="size-3" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">฿</span>
                      <Input
                        type="number"
                        placeholder="Price"
                        className="pl-4 h-7 text-xs"
                        value={item.price}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx].price = e.target.value
                          setReceiptItems(next)
                        }}
                      />
                    </div>
                    <div className="relative w-20">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">Tax</span>
                      <Input
                        type="number"
                        placeholder="0"
                        className="pl-6 h-7 text-xs"
                        value={item.tax}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx].tax = e.target.value
                          setReceiptItems(next)
                        }}
                      />
                    </div>

                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ml-2">
                      = ฿{((parseFloat(item.price) || 0) + (parseFloat(item.tax) || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
