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
import { Label } from '@/components/ui/label'
import { Transaction } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import { useTrips } from '@/hooks/use-trips'
import { ContactSelect } from '@/components/friends/contact-select'

const formSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(1, 'Description is required'),
  date: z.string(),
  time: z.string().min(1, 'Time is required'),
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
  const [currency, setCurrency] = React.useState<'THB' | 'JPY'>(initialData?.currency || 'THB')

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

  const defaultTime = initialData?.date?.seconds
    ? new Date(initialData.date.seconds * 1000).toISOString().slice(11, 16)
    : new Date().toISOString().slice(11, 16);

  const [subtotal, setSubtotal] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.baseAmount ? String(initialData.baseAmount) : '')
  const [tax, setTax] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.taxAmount ? String(initialData.taxAmount) : '')
  const [receiptTaxMode, setReceiptTaxMode] = React.useState<'exclusive' | 'inclusive'>('exclusive')
  const [receiptTax, setReceiptTax] = React.useState(
    initialData?.taxAmount 
      ? String(initialData.taxAmount) 
      : (initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0) || 0) > 0
        ? String(initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0))
        : ''
  )

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initialData ? Math.abs(initialData.amount).toString() : '',
      type: initialData?.type || 'expense',
      category: initialData?.category || '',
      description: initialData?.description || '',
      date: defaultDate,
      time: defaultTime,
      paidBy: initialData?.paidBy || 'Me',
      splitWith: initialData?.splitWith || '',
      tripId: initialData?.tripId || 'none',
    },
  })

  const isReceiptActive = inputMode === 'receipt' && receiptItems.some(item => (parseFloat(item.price) || 0) > 0)
  
  let totalBase = 0
  let totalTax = isReceiptActive ? (parseFloat(receiptTax) || 0) : 0
  let calculatedTotal = 0

  if (isReceiptActive) {
    if (receiptTaxMode === 'exclusive') {
      receiptItems.forEach(item => {
        totalBase += parseFloat(item.price) || 0
      })
      calculatedTotal = totalBase + totalTax
    } else {
      // Inclusive: sum of items is the total receipt amount
      receiptItems.forEach(item => {
        calculatedTotal += parseFloat(item.price) || 0
      })
      totalBase = Math.max(0, calculatedTotal - totalTax)
    }
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
        category: values.category,
        description: values.description,
        date: Timestamp.fromDate(new Date(`${values.date}T${values.time}`)),
        paidBy: values.paidBy || 'Me',
        splitWith: values.splitWith || null,
        tripId: values.tripId && values.tripId !== 'none' ? values.tripId : null,
        receiptUrl: initialData?.receiptUrl || null,
        source: initialData?.source || 'manual',
        currency,
      }

      if (isReceiptActive) {
        transactionData.items = receiptItems.map(item => {
          const rawVal = parseFloat(item.price) || 0
          let p = 0
          let t = 0
          if (receiptTaxMode === 'exclusive') {
            p = rawVal
            t = totalBase > 0 ? (p / totalBase) * totalTax : 0
          } else {
            const itemTotal = rawVal
            t = calculatedTotal > 0 ? (itemTotal / calculatedTotal) * totalTax : 0
            p = Math.max(0, itemTotal - t)
          }
          return {
            name: item.name || 'Item',
            category: item.category,
            price: parseFloat(p.toFixed(2)),
            tax: parseFloat(t.toFixed(2)),
            splitWith: []
          }
        })
        transactionData.baseAmount = totalBase
        transactionData.taxAmount = totalTax
        transactionData.taxMode = receiptTaxMode
      } else {
        transactionData.baseAmount = parseFloat(subtotal) || rawAmount || 0
        transactionData.taxAmount = parseFloat(tax) || 0
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

        {/* Currency Selector */}
        <div className="space-y-1.5">
          <FormLabel>สกุลเงิน (Currency)</FormLabel>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={currency === 'THB' ? 'default' : 'outline'}
              className="flex-1 text-xs gap-1 h-9 font-medium"
              onClick={() => setCurrency('THB')}
            >
              ฿ บาท (THB)
            </Button>
            <Button
              type="button"
              variant={currency === 'JPY' ? 'default' : 'outline'}
              className="flex-1 text-xs gap-1 h-9 font-medium"
              onClick={() => setCurrency('JPY')}
            >
              ¥ เยน (JPY)
            </Button>
          </div>
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

        {/* If inputMode is standard, show separate Price and Tax next to Total! */}
        {inputMode === 'standard' && (
          <div className="grid grid-cols-3 gap-3 border p-3 rounded-lg bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs">ราคาสินค้า ({currency === 'THB' ? '฿' : '¥'})</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={subtotal}
                onChange={e => {
                  const val = e.target.value
                  setSubtotal(val)
                  const sub = parseFloat(val) || 0
                  const tx = parseFloat(tax) || 0
                  const nextAmount = sub > 0 || tx > 0 ? (sub + tx).toString() : ''
                  form.setValue('amount', nextAmount)
                }}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ภาษี ({currency === 'THB' ? '฿' : '¥'})</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={tax}
                onChange={e => {
                  const val = e.target.value
                  setTax(val)
                  const sub = parseFloat(subtotal) || 0
                  const tx = parseFloat(val) || 0
                  const nextAmount = sub > 0 || tx > 0 ? (sub + tx).toString() : ''
                  form.setValue('amount', nextAmount)
                }}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">ยอดรวม ({currency === 'THB' ? '฿' : '¥'})</Label>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={field.value}
                        onChange={e => {
                          field.onChange(e)
                          setSubtotal('')
                          setTax('')
                        }}
                        className="h-9 text-xs font-semibold border-primary/40 focus-visible:ring-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {inputMode === 'receipt' && (
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({currency === 'THB' ? '฿' : '¥'})</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      disabled={true}
                      value={calculatedTotal.toFixed(2)}
                      onChange={field.onChange} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem className={cn(inputMode === 'standard' && "col-span-2")}>
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
                  <ContactSelect
                    value={field.value || 'Me'}
                    onChange={field.onChange}
                    placeholder="เลือกผู้จ่าย"
                  />
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
                  <ContactSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="เลือกผู้แบ่งจ่าย (ไม่บังคับ)"
                    allowNone
                    includeMe={false}
                  />
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

        <div className="grid grid-cols-2 gap-4">
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
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Receipt Items (Only in Receipt Mode) */}
        {inputMode === 'receipt' && (
          <div className="space-y-4 border rounded-lg p-3 bg-muted/20 overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
              <div className="flex items-center gap-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Items</h4>
                {/* Premium Tax Mode Switch Toggle */}
                <div className="inline-flex rounded-lg border p-0.5 bg-muted/60 text-[10px] shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => setReceiptTaxMode('exclusive')}
                    className={cn(
                      "px-2 py-0.5 rounded-md font-medium transition-all",
                      receiptTaxMode === 'exclusive'
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ยังไม่รวมภาษี (Exclusive)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptTaxMode('inclusive')}
                    className={cn(
                      "px-2 py-0.5 rounded-md font-medium transition-all",
                      receiptTaxMode === 'inclusive'
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    รวมภาษีแล้ว (Inclusive)
                  </button>
                </div>
              </div>

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
              {receiptItems.map((item, idx) => {
                const rawVal = parseFloat(item.price) || 0
                let p = 0
                let t = 0
                let itemTotal = 0

                if (receiptTaxMode === 'exclusive') {
                  p = rawVal
                  t = totalBase > 0 ? (p / totalBase) * totalTax : 0
                  itemTotal = p + t
                } else {
                  itemTotal = rawVal
                  t = calculatedTotal > 0 ? (itemTotal / calculatedTotal) * totalTax : 0
                  p = Math.max(0, itemTotal - t)
                }

                return (
                  <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 pt-2">
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                      {/* Name Input - Premium Sizing */}
                      <Input
                        placeholder="Product Name"
                        className="flex-grow min-w-[120px] h-9 text-xs shrink"
                        value={item.name}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx].name = e.target.value
                          setReceiptItems(next)
                        }}
                      />
                      
                      {/* Category Selector */}
                      <Select
                        value={item.category}
                        onValueChange={val => {
                          const next = [...receiptItems]
                          next[idx].category = val
                          setReceiptItems(next)
                        }}
                      >
                        <SelectTrigger className="w-24 sm:w-28 h-9 text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      {/* Price Input */}
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                          {currency === 'THB' ? '฿' : '¥'}
                        </span>
                        <Input
                          type="number"
                          placeholder={receiptTaxMode === 'exclusive' ? "Excl. Tax" : "Incl. Tax"}
                          className="pl-6 pr-1 h-9 text-xs font-medium"
                          value={item.price}
                          onChange={e => {
                            const next = [...receiptItems]
                            next[idx].price = e.target.value
                            setReceiptItems(next)
                          }}
                        />
                      </div>

                      {/* Calculated Total (Price + Proportional Tax) */}
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0 min-w-[60px] text-right">
                        ={currency === 'THB' ? '฿' : '¥'}{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>

                      {/* Delete Product Button */}
                      {receiptItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                        >
                          <Minus className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Receipt Level Summary & Tax Breakdown */}
            <div className="grid grid-cols-3 gap-3 border-t pt-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ราคาสินค้ารวม (Subtotal)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    {currency === 'THB' ? '฿' : '¥'}
                  </span>
                  <Input
                    type="number"
                    disabled
                    className="pl-6 h-9 text-xs bg-muted/50 font-medium tabular-nums"
                    value={totalBase.toFixed(2)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold text-primary">ภาษีรวมทั้งใบเสร็จ (Tax)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    {currency === 'THB' ? '฿' : '¥'}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-6 h-9 text-xs font-semibold border-primary/40 focus-visible:ring-primary"
                    value={receiptTax}
                    onChange={e => setReceiptTax(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-bold text-foreground">ยอดรวมสุทธิ (Total)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    {currency === 'THB' ? '฿' : '¥'}
                  </span>
                  <Input
                    type="number"
                    disabled
                    className="pl-6 h-9 text-xs bg-muted/30 font-bold tabular-nums text-foreground border-muted-foreground/30"
                    value={calculatedTotal.toFixed(2)}
                  />
                </div>
              </div>
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
