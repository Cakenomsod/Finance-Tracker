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
import { OptionalNoteField } from '@/components/shared/optional-note-field'
import { ImmichAttachmentsField } from '@/components/shared/immich-attachments-field'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { Transaction } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import { useTrips } from '@/hooks/use-trips'
import { ContactSelect } from '@/components/friends/contact-select'
import {
  TransactionSplitSection,
  validateTransactionSplit,
} from '@/components/transactions/transaction-split-section'
import {
  primaryPaidByFromSplit,
  resolveTransactionSplit,
  type TransactionSplitMode,
} from '@/lib/transaction-split'
import type { TripExpensePayer, TripExpenseShare } from '@/lib/firestore-types'
import {
  buildPaotangPaymentFields,
  computePaotangSplitWithQuota,
  getPaotangCapReasonLabel,
  getPaotangQuotaMode,
  getPaotangUsageFromTransactions,
  isPaotangPaidByOther,
  PAOTANG_DAILY_GOV_MAX,
  PAOTANG_GOV_PERCENT,
  PAOTANG_MONTHLY_QUOTA,
  PAOTANG_TOTAL_QUOTA,
  PAOTANG_USER_PERCENT,
} from '@/lib/transaction-payment'
import type { PaymentMethod } from '@/lib/firestore-types'
import {
  formatLocalDateInput,
  formatLocalTimeInput,
  parseLocalDateTime,
  toDateFromFirestore,
} from '@/lib/datetime'
import { useCategories } from '@/hooks/use-categories'

const formSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(1, 'Description is required'),
  date: z.string(),
  time: z.string().min(1, 'Time is required'),
  paidBy: z.string().optional(),
  tripId: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof formSchema>

interface TransactionFormProps {
  initialData?: Transaction | null;
  existingTransactions?: Transaction[];
  pendingImmichAssetIds?: string[];
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onCancel: () => void;
}

interface ReceiptItemInput {
  name: string
  category: string
  price: string
}

export function TransactionForm({
  initialData,
  existingTransactions = [],
  pendingImmichAssetIds,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { activeTrips } = useTrips()
  const { categories, expenseCategories, incomeCategories, loading: categoriesLoading } = useCategories()

  const expenseCategoryNames = React.useMemo(
    () => expenseCategories.map((c) => c.name),
    [expenseCategories]
  )
  const incomeCategoryNames = React.useMemo(
    () => incomeCategories.map((c) => c.name),
    [incomeCategories]
  )
  const incomeNameSet = React.useMemo(
    () => new Set(incomeCategoryNames),
    [incomeCategoryNames]
  )

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(
    initialData?.paymentMethod || 'normal'
  )
  const [note, setNote] = React.useState(initialData?.note || '')
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>(() =>
    collectImmichAssetIds({
      immichAssetId: initialData?.immichAssetId,
      immichAssetIds: initialData?.immichAssetIds,
    })
  )

  React.useEffect(() => {
    setAttachmentIds(
      collectImmichAssetIds({
        immichAssetId: initialData?.immichAssetId,
        immichAssetIds: initialData?.immichAssetIds,
      })
    )
  }, [initialData?.id])

  React.useEffect(() => {
    if (pendingImmichAssetIds?.length) {
      setAttachmentIds((prev) => [...new Set([...prev, ...pendingImmichAssetIds])])
    }
  }, [pendingImmichAssetIds])

  const [inputMode, setInputMode] = React.useState<'standard' | 'receipt'>(
    initialData?.items && initialData.items.length > 0 ? 'receipt' : 'standard'
  )

  const [receiptItems, setReceiptItems] = React.useState<ReceiptItemInput[]>(
    initialData?.items?.map(item => ({
      name: item.name,
      category: item.category,
      price: String(item.price + (item.tax || 0)),
    })) || [
      { name: '', category: '', price: '' }
    ]
  )

  const initialDate = toDateFromFirestore(initialData?.date) ?? new Date()
  const defaultDate = formatLocalDateInput(initialDate)
  const defaultTime = formatLocalTimeInput(initialDate)

  const defaultType = initialData?.type || 'expense'

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initialData ? Math.abs(initialData.amount).toString() : '',
      type: defaultType,
      category: initialData?.category || '',
      description: initialData?.description || '',
      date: defaultDate,
      time: defaultTime,
      paidBy: initialData?.paidBy || 'Me',
      tripId: initialData?.tripId || 'none',
    },
  })

  const txType = form.watch('type')
  const selectedCategory = form.watch('category')
  const selectedTripId = form.watch('tripId')
  const isIncome = txType === 'income'

  React.useEffect(() => {
    if (categoriesLoading || initialData?.category) return
    const type = form.getValues('type')
    const fallback =
      type === 'income' ? incomeCategoryNames[0] : expenseCategoryNames[0]
    if (fallback && !form.getValues('category')) {
      form.setValue('category', fallback)
    }
  }, [
    categoriesLoading,
    expenseCategoryNames,
    incomeCategoryNames,
    initialData?.category,
    form,
  ])

  React.useEffect(() => {
    if (categoriesLoading || !expenseCategoryNames[0]) return
    setReceiptItems((items) => {
      if (!items.some((item) => !item.category)) return items
      return items.map((item) =>
        item.category ? item : { ...item, category: expenseCategoryNames[0] }
      )
    })
  }, [categoriesLoading, expenseCategoryNames])

  React.useEffect(() => {
    if (txType === 'income' && selectedCategory && !incomeNameSet.has(selectedCategory)) {
      const fallback = incomeCategoryNames[0]
      if (fallback) form.setValue('category', fallback)
    }
  }, [txType, selectedCategory, incomeNameSet, incomeCategoryNames, form])

  React.useEffect(() => {
    if (selectedCategory && incomeNameSet.has(selectedCategory) && txType !== 'income') {
      form.setValue('type', 'income')
    }
  }, [selectedCategory, txType, incomeNameSet, form])

  const resolvedInitialSplit = React.useMemo(
    () => (initialData && !isIncome ? resolveTransactionSplit(initialData) : null),
    [initialData, isIncome]
  )

  const [splitEnabled, setSplitEnabled] = React.useState(
    () => !!(resolvedInitialSplit && (initialData?.splitWith || initialData?.payers?.length))
  )
  const [splitData, setSplitData] = React.useState<{
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: TransactionSplitMode
  } | null>(resolvedInitialSplit)

  const handleSplitChange = React.useCallback(
    (data: {
      payers: TripExpensePayer[]
      shares: TripExpenseShare[]
      splitMode: TransactionSplitMode
    }) => {
      setSplitData(data)
    },
    []
  )

  React.useEffect(() => {
    if (isIncome && paymentMethod !== 'normal') {
      setPaymentMethod('normal')
    }
  }, [isIncome, paymentMethod])

  const isReceiptMode = inputMode === 'receipt'

  const receiptTotal = React.useMemo(
    () =>
      receiptItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0),
    [receiptItems]
  )

  React.useEffect(() => {
    if (isReceiptMode) {
      form.setValue(
        'amount',
        receiptTotal > 0 ? receiptTotal.toFixed(2) : '',
        { shouldValidate: true }
      )
    }
  }, [isReceiptMode, receiptTotal, form])

  const watchedAmount = form.watch('amount')
  const watchedDate = form.watch('date')
  const watchedTime = form.watch('time')
  const watchedPaidBy = form.watch('paidBy')

  const totalForPayment = isReceiptMode
    ? receiptTotal
    : parseFloat(watchedAmount) || 0

  const txPreviewDate = React.useMemo(() => {
    if (!watchedDate) return new Date()
    return parseLocalDateTime(watchedDate, watchedTime || '12:00')
  }, [watchedDate, watchedTime])

  const isOtherPayerPaotang =
    paymentMethod === 'paotang' && isPaotangPaidByOther(watchedPaidBy)
  const paotangQuotaMode = getPaotangQuotaMode(watchedPaidBy)
  const paotangQuotaOwner = isOtherPayerPaotang ? watchedPaidBy! : 'Me'

  const paotangUsage = React.useMemo(
    () =>
      getPaotangUsageFromTransactions(existingTransactions, {
        excludeTxId: initialData?.id,
        forDate: txPreviewDate,
        quotaOwner: paotangQuotaOwner,
      }),
    [existingTransactions, initialData?.id, txPreviewDate, paotangQuotaOwner]
  )

  const paotangSplit =
    paymentMethod === 'paotang' && totalForPayment > 0
      ? computePaotangSplitWithQuota(totalForPayment, paotangUsage, paotangQuotaMode)
      : null

  const splitTotal = React.useMemo(() => {
    if (isOtherPayerPaotang) return totalForPayment
    if (paymentMethod === 'paotang' && !isIncome) return totalForPayment
    return totalForPayment
  }, [isOtherPayerPaotang, paymentMethod, isIncome, totalForPayment])

  const handleSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true)
    try {
      const rawAmount = isReceiptMode ? receiptTotal : parseFloat(values.amount)

      if (isNaN(rawAmount) || rawAmount <= 0) {
        form.setError('amount', {
          message: isReceiptMode
            ? 'กรุณาเพิ่มรายการใบเสร็จและระบุราคา'
            : 'Amount must be a positive number',
        })
        return
      }

      const usePaotang = !isIncome && paymentMethod === 'paotang'

      if (
        !isIncome &&
        splitEnabled &&
        !isOtherPayerPaotang &&
        splitData &&
        splitTotal > 0
      ) {
        const splitErrs = validateTransactionSplit(splitTotal, splitData.payers, splitData.shares)
        if (splitErrs.length > 0) {
          form.setError('amount', { message: splitErrs[0] })
          return
        }
      }

      const finalAmount = values.type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount)

      let paidBy = isIncome ? (values.paidBy || '') : (values.paidBy || 'Me')
      let splitWith: string | null = null
      let payers: TripExpensePayer[] | undefined
      let shares: TripExpenseShare[] | undefined
      let splitMode: TransactionSplitMode | undefined

      if (!isIncome && splitEnabled && splitData && !isOtherPayerPaotang) {
        payers = splitData.payers
        shares = splitData.shares
        splitMode = splitData.splitMode
        paidBy = primaryPaidByFromSplit(splitData)
        splitWith = null
      } else if (!isIncome) {
        payers = []
        shares = []
        splitMode = undefined
        if (isOtherPayerPaotang) {
          paidBy = values.paidBy || 'Me'
        } else {
          paidBy = 'Me'
        }
      }

      const uniqueAttachmentIds = [...new Set(attachmentIds)]
      const primaryAttachment = uniqueAttachmentIds[0] ?? null

      const transactionData: Omit<Transaction, 'id' | 'createdAt' | 'userId'> = {
        amount: finalAmount,
        type: values.type,
        category: values.category,
        description: values.description,
        date: Timestamp.fromDate(parseLocalDateTime(values.date, values.time)),
        paidBy,
        splitWith,
        payers,
        shares,
        splitMode,
        tripId: values.tripId && values.tripId !== 'none' ? values.tripId : null,
        receiptUrl: primaryAttachment ? `/api/immich/asset/${primaryAttachment}` : null,
        source: initialData?.source || 'manual',
        currency: 'THB',
        note: note.trim() || undefined,
      }

      if (uniqueAttachmentIds.length) {
        transactionData.immichAssetIds = uniqueAttachmentIds
        transactionData.immichAssetId = primaryAttachment
      } else {
        transactionData.immichAssetIds = undefined
        transactionData.immichAssetId = null
      }

      if (isReceiptMode) {
        transactionData.items = receiptItems
          .filter(item => (parseFloat(item.price) || 0) > 0)
          .map(item => ({
            name: item.name || 'Item',
            category: item.category,
            price: parseFloat(item.price) || 0,
            tax: 0,
            splitWith: [],
          }))
        transactionData.baseAmount = receiptTotal
        transactionData.taxAmount = 0
      } else {
        transactionData.baseAmount = rawAmount
        transactionData.taxAmount = 0
      }

      if (usePaotang) {
        const paidBy = isIncome ? values.paidBy : (values.paidBy || 'Me')
        const usage = getPaotangUsageFromTransactions(existingTransactions, {
          excludeTxId: initialData?.id,
          forDate: parseLocalDateTime(values.date, values.time),
          quotaOwner: isPaotangPaidByOther(paidBy) ? paidBy : 'Me',
        })
        Object.assign(transactionData, buildPaotangPaymentFields(rawAmount, usage, paidBy))
      } else {
        transactionData.paymentMethod = 'normal'
        transactionData.paotangSubsidy = null
        transactionData.paotangUserPaid = null
        transactionData.paotangIdealSubsidy = null
        transactionData.paotangQuotaCapped = false
        transactionData.paotangCapReason = null
      }

      await onSubmit(transactionData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleCategories = React.useMemo(() => {
    const base = isIncome ? incomeCategoryNames : expenseCategoryNames
    const current = form.getValues('category')
    if (current && !base.includes(current)) return [...base, current]
    return base
  }, [isIncome, selectedCategory, incomeCategoryNames, expenseCategoryNames, form])

  const categoryByName = React.useMemo(
    () => new Map(categories.map((c) => [c.name, c])),
    [categories]
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        <ImmichAttachmentsField
          value={attachmentIds}
          onChange={setAttachmentIds}
          tripId={selectedTripId}
        />
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
              <Select
                onValueChange={(val) => {
                  field.onChange(val)
                  if (val === 'expense' && incomeNameSet.has(form.getValues('category'))) {
                    const fallback = expenseCategoryNames[0]
                    if (fallback) form.setValue('category', fallback)
                  }
                }}
                value={field.value}
              >
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

        {inputMode === 'receipt' && (
          <div className="space-y-4 border rounded-lg p-3 bg-muted/20">
            <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Items</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setReceiptItems([
                    ...receiptItems,
                    { name: '', category: expenseCategoryNames[0] || '', price: '' },
                  ])
                }
                className="h-7 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Product
              </Button>
            </div>

            <div className="space-y-3">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 pt-2 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <Input
                      placeholder="Product Name"
                      className="h-9 text-xs"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], name: e.target.value }
                        setReceiptItems(next)
                      }}
                    />

                    <Select
                      value={item.category || undefined}
                      onValueChange={val => {
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], category: val }
                        setReceiptItems(next)
                      }}
                    >
                      <SelectTrigger className="h-9 w-full text-xs sm:w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(expenseCategoryNames.includes(item.category)
                          ? expenseCategoryNames
                          : item.category
                            ? [...expenseCategoryNames, item.category]
                            : expenseCategoryNames
                        ).map((c) => {
                          const cat = categoryByName.get(c)
                          return (
                            <SelectItem key={c} value={c} className="text-xs">
                              {cat ? `${cat.icon} ${c}` : c}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        ฿
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-6 pr-1 h-9 text-xs font-medium"
                        value={item.price}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx] = { ...next[idx], price: e.target.value }
                          setReceiptItems(next)
                        }}
                      />
                    </div>
                  </div>

                  {receiptItems.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      >
                        <Minus className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setReceiptItems([
                  ...receiptItems,
                  { name: '', category: expenseCategoryNames[0] || '', price: '' },
                ])
              }
              className="h-8 w-full gap-1 border-dashed text-xs"
            >
              <Plus className="size-3" /> เพิ่มรายการ
            </Button>

            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">ยอดรวมสุทธิ</Label>
                <span className="text-lg font-bold tabular-nums">
                  ฿{receiptTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {inputMode === 'standard' && (
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {paymentMethod === 'paotang' && !isIncome ? 'ยอดเต็ม (฿)' : 'จำนวนเงิน (฿)'}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      ฿
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-8 h-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          {inputMode === 'receipt' && (
            <FormField
              control={form.control}
              name="amount"
              render={() => (
                <FormItem>
                  <FormLabel>ยอดรวม (฿)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        ฿
                      </span>
                      <Input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        className="pl-8 h-10 font-semibold bg-muted/50"
                        value={receiptTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      />
                    </div>
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
                <Select
                  onValueChange={field.onChange}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!categoriesLoading &&
                      visibleCategories.map((c) => {
                        const cat = categoryByName.get(c)
                        return (
                          <SelectItem key={c} value={c}>
                            {cat ? `${cat.icon} ${c}` : c}
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!isIncome && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-medium">วิธีชำระเงิน</p>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setPaymentMethod('normal')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                  paymentMethod === 'normal'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                จ่ายปกติ
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('paotang')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                  paymentMethod === 'paotang'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                เป๋าตัง
              </button>
            </div>

            {paymentMethod === 'paotang' && (
              <div className="space-y-3">
                <div className="rounded-md border bg-background/80 p-3 text-xs space-y-2">
                  <p className="font-medium text-sm">
                    {isOtherPayerPaotang
                      ? `โควต้าเป๋าตังของ ${watchedPaidBy}`
                      : 'โควต้าเป๋าตังของคุณ'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOtherPayerPaotang
                      ? `ตรวจเฉพาะรัฐจ่ายสูงสุด ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}/วัน (ไม่นับโควต้ารวม/รายเดือนของคุณ)`
                      : `รวม ฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} · เดือนละ ฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()} (ไม่ยกยอด) · วันละรัฐจ่ายสูงสุด ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`}
                  </p>
                  <div className={cn('grid gap-2', isOtherPayerPaotang ? 'grid-cols-1' : 'sm:grid-cols-3')}>
                    {(isOtherPayerPaotang
                      ? [
                          {
                            label: `วันนี้ — ${watchedPaidBy} (รัฐจ่าย)`,
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                      : [
                          {
                            label: 'โควต้ารวม',
                            used: paotangUsage.totalUsed,
                            max: PAOTANG_TOTAL_QUOTA,
                            remaining:
                              paotangSplit?.remaining.total ??
                              PAOTANG_TOTAL_QUOTA - paotangUsage.totalUsed,
                          },
                          {
                            label: 'เดือนนี้',
                            used: paotangUsage.monthUsed,
                            max: PAOTANG_MONTHLY_QUOTA,
                            remaining:
                              paotangSplit?.remaining.month ??
                              PAOTANG_MONTHLY_QUOTA - paotangUsage.monthUsed,
                          },
                          {
                            label: 'วันนี้ (รัฐจ่าย)',
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                    ).map((q) => (
                      <div key={q.label} className="rounded border bg-muted/30 p-2">
                        <p className="text-[10px] text-muted-foreground">{q.label}</p>
                        <p className="font-semibold tabular-nums text-[11px]">
                          เหลือ ฿{Math.max(0, q.remaining).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          ใช้ ฿{q.used.toLocaleString()} / ฿{q.max.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {totalForPayment > 0 && paotangSplit && (
                  <div className="rounded-md border bg-background p-3 text-sm space-y-2">
                    {isOtherPayerPaotang ? (
                      <>
                        <p className="text-muted-foreground">
                          {watchedPaidBy} จ่ายให้ด้วยเป๋าตัง — คุณคืนเขา {PAOTANG_USER_PERCENT}%
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] text-muted-foreground">ยอดเต็ม</p>
                            <p className="font-semibold tabular-nums">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">
                              รัฐจ่ายให้ {watchedPaidBy}
                            </p>
                            <p className="font-semibold tabular-nums text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              {paotangSplit.capped && (
                                <span className="text-[10px] font-normal text-muted-foreground block">
                                  (ปกติ ฿{paotangSplit.idealSubsidy.toLocaleString()})
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">
                              คุณคืน {watchedPaidBy} ({PAOTANG_USER_PERCENT}%)
                            </p>
                            <p className="font-semibold tabular-nums text-destructive">
                              ฿{paotangSplit.oweToPayer?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-[11px] text-warning">
                            {watchedPaidBy} ใช้โควต้ารายวันครบแล้ว — {getPaotangCapReasonLabel(paotangSplit.capReason)}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          หนี้ที่ติด = {PAOTANG_USER_PERCENT}% ของยอดเต็ม (ไม่รวมส่วนรัฐจ่าย)
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          เป๋าตัง: รัฐจ่าย {PAOTANG_GOV_PERCENT}% · เราจ่ายส่วนที่เหลือ
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] text-muted-foreground">ยอดเต็ม</p>
                            <p className="font-semibold tabular-nums">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">รัฐจ่ายจริง</p>
                            <p className="font-semibold tabular-nums text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              {paotangSplit.capped && (
                                <span className="text-[10px] font-normal text-muted-foreground block">
                                  (ปกติ ฿{paotangSplit.idealSubsidy.toLocaleString()})
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">เราจ่ายจริง</p>
                            <p className="font-semibold tabular-nums text-destructive">
                              ฿{paotangSplit.userPaid.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-[11px] text-warning">
                            โควต้าไม่พอ — ถูกจำกัดโดย{getPaotangCapReasonLabel(paotangSplit.capReason)}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          ใช้ยอด &quot;เราจ่ายจริง&quot; คำนวณหนี้/แบ่งจ่าย
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isIncome ? (
          <FormField
            control={form.control}
            name="paidBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Received From</FormLabel>
                <FormControl>
                  <ContactSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="เลือกผู้จ่ายให้ (ไม่บังคับ)"
                    allowNone
                    noneLabel="ไม่ระบุ"
                    includeMe={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : isOtherPayerPaotang ? (
          <FormField
            control={form.control}
            name="paidBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid By</FormLabel>
                <FormControl>
                  <ContactSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="เลือกผู้จ่าย"
                    includeMe={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>แบ่งค่าใช้จ่ายกับเพื่อน</Label>
              <button
                type="button"
                onClick={() => {
                  const next = !splitEnabled
                  setSplitEnabled(next)
                  if (!next) setSplitData(null)
                }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  splitEnabled
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {splitEnabled ? 'เปิดอยู่' : 'ปิด'}
              </button>
            </div>
            {splitEnabled && splitTotal > 0 && (
              <TransactionSplitSection
                total={splitTotal}
                initialPayers={resolvedInitialSplit?.payers}
                initialShares={resolvedInitialSplit?.shares}
                initialSplitMode={resolvedInitialSplit?.splitMode}
                onChange={handleSplitChange}
              />
            )}
            {splitEnabled && splitTotal <= 0 && (
              <p className="text-xs text-muted-foreground">กรอกจำนวนเงินก่อนเพื่อตั้งค่าการแบ่งจ่าย</p>
            )}
          </div>
        )}

        {activeTrips.length > 0 && (
          <FormField
            control={form.control}
            name="tripId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trip (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">วันที่และเวลา</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" className="h-10 w-full" {...field} />
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
                    <Input type="time" className="h-10 w-full" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <OptionalNoteField value={note} onChange={setNote} />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || categoriesLoading}>
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
