import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
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
import { usePaotangUsage } from '@/hooks/use-paotang-usage'

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
  const [debtTracking, setDebtTracking] = React.useState(
    initialData?.debtTracking !== false
  )
  const [paotangPayerMode, setPaotangPayerMode] = React.useState<'self' | 'other'>(() => {
    if (initialData?.paymentMethod === 'paotang' && isPaotangPaidByOther(initialData.paidBy)) {
      return 'other'
    }
    return 'self'
  })
  const [note, setNote] = React.useState(initialData?.note || '')
  const [discount, setDiscount] = React.useState(
    initialData?.discount ? String(initialData.discount) : ''
  )
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

  const [splitEnabled, setSplitEnabled] = React.useState(() => {
    if (!initialData) return false
    if (initialData.splitWith) return true
    if (initialData.splitMode && initialData.splitMode !== 'solo') return true
    if ((initialData.payers?.length ?? 0) > 1) return true
    if ((initialData.shares?.length ?? 0) > 1) return true
    return false
  })
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

  const discountAmount = isIncome ? 0 : (parseFloat(discount) || 0)
  const receiptNet = Math.max(0, receiptTotal - discountAmount)

  React.useEffect(() => {
    if (isReceiptMode) {
      form.setValue(
        'amount',
        receiptNet > 0 ? receiptNet.toFixed(2) : '',
        { shouldValidate: true }
      )
    }
  }, [isReceiptMode, receiptNet, form])

  const watchedAmount = form.watch('amount')
  const watchedDate = form.watch('date')
  const watchedTime = form.watch('time')
  const watchedPaidBy = form.watch('paidBy')

  const totalForPayment = isReceiptMode
    ? receiptNet
    : parseFloat(watchedAmount) || 0

  const txPreviewDate = React.useMemo(() => {
    if (!watchedDate) return new Date()
    return parseLocalDateTime(watchedDate, watchedTime || '12:00')
  }, [watchedDate, watchedTime])

  const isOtherPayerPaotang =
    paymentMethod === 'paotang' &&
    !splitEnabled &&
    paotangPayerMode === 'other' &&
    isPaotangPaidByOther(watchedPaidBy)
  const paotangQuotaMode = getPaotangQuotaMode(
    splitEnabled ? 'Me' : paotangPayerMode === 'other' ? watchedPaidBy : 'Me'
  )
  const paotangQuotaOwner = isOtherPayerPaotang ? watchedPaidBy! : 'Me'

  React.useEffect(() => {
    if (paymentMethod !== 'paotang' || splitEnabled) return
    if (paotangPayerMode === 'self') {
      form.setValue('paidBy', 'Me')
    }
  }, [paymentMethod, paotangPayerMode, splitEnabled, form])

  const paotangUsage = usePaotangUsage({
    forDate: txPreviewDate,
    quotaOwner: paotangQuotaOwner,
    excludeTxId: initialData?.id,
  })

  const paotangSplit =
    paymentMethod === 'paotang' && totalForPayment > 0
      ? computePaotangSplitWithQuota(totalForPayment, paotangUsage, paotangQuotaMode)
      : null

  const splitTotal = totalForPayment

  const handleSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true)
    try {
      const disc = isIncome ? 0 : (parseFloat(discount) || 0)
      let rawAmount: number
      if (isReceiptMode) {
        if (disc > 0 && receiptTotal > 0 && disc > receiptTotal) {
          form.setError('amount', { message: 'ส่วนลดต้องไม่เกินยอดรวม' })
          return
        }
        rawAmount = receiptNet
      } else {
        rawAmount = parseFloat(values.amount) || 0
      }

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
        splitData &&
        splitTotal > 0
      ) {
        const splitErrs = validateTransactionSplit(splitTotal, splitData.payers, splitData.shares)
        if (splitErrs.length > 0) {
          form.setError('amount', { message: splitErrs[0] })
          return
        }
      }

      if (
        !isIncome &&
        paymentMethod === 'paotang' &&
        !splitEnabled &&
        paotangPayerMode === 'other' &&
        !values.paidBy
      ) {
        form.setError('paidBy', { message: 'กรุณาเลือกผู้จ่าย' })
        return
      }

      const finalAmount = values.type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount)

      let paidBy = isIncome ? (values.paidBy || '') : (values.paidBy || 'Me')
      let splitWith: string | null = null
      let payers: TripExpensePayer[] | undefined
      let shares: TripExpenseShare[] | undefined
      let splitMode: TransactionSplitMode | undefined

      if (!isIncome && splitEnabled && splitData) {
        payers = splitData.payers
        shares = splitData.shares
        splitMode = splitData.splitMode
        paidBy = primaryPaidByFromSplit(splitData)
        splitWith = null
      } else if (!isIncome) {
        payers = []
        shares = []
        splitMode = undefined
        if (paymentMethod === 'paotang' && paotangPayerMode === 'other') {
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
        debtTracking: !isIncome ? debtTracking : undefined,
      }

      if (uniqueAttachmentIds.length) {
        transactionData.immichAssetIds = uniqueAttachmentIds
        transactionData.immichAssetId = primaryAttachment
      } else {
        transactionData.immichAssetIds = undefined
        transactionData.immichAssetId = null
      }

      if (disc > 0) {
        transactionData.discount = disc
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
        transactionData.baseAmount = disc > 0 ? rawAmount + disc : rawAmount
        transactionData.taxAmount = 0
      }

      if (usePaotang) {
        const mePayer = splitEnabled ? splitData?.payers.find((p) => p.userId === 'Me') : null
        const paotangBase = mePayer?.amount ?? rawAmount
        const quotaOwner =
          splitEnabled && mePayer
            ? 'Me'
            : paotangPayerMode === 'other' && values.paidBy
              ? values.paidBy
              : 'Me'
        Object.assign(
          transactionData,
          buildPaotangPaymentFields(paotangBase, paotangUsage, quotaOwner)
        )
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2 sm:space-y-4 sm:py-4">
        <ImmichAttachmentsField
          value={attachmentIds}
          onChange={setAttachmentIds}
          tripId={selectedTripId}
          deliveryKey={
            initialData?.id
              ? `attachments:transaction:${initialData.id}`
              : 'attachments:transaction:new'
          }
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

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Type</FormLabel>
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
                    <SelectTrigger className="h-9">
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
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

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm">Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter details about this transaction"
                  className="min-h-[4.5rem] resize-none text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {inputMode === 'receipt' && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-muted-foreground">รายการสินค้า</h4>
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
                className="h-7 shrink-0 gap-1 px-2 text-xs"
              >
                <Plus className="size-3" /> เพิ่ม
              </Button>
            </div>

            <div className="space-y-2.5">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="space-y-1.5 border-b pb-2.5 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Product Name"
                      className="h-8 min-w-0 flex-1 text-xs"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], name: e.target.value }
                        setReceiptItems(next)
                      }}
                    />
                    {receiptItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
                    <Select
                      value={item.category || undefined}
                      onValueChange={val => {
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], category: val }
                        setReceiptItems(next)
                      }}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
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
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        ฿
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-8 pl-5 pr-1 text-xs font-medium"
                        value={item.price}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx] = { ...next[idx], price: e.target.value }
                          setReceiptItems(next)
                        }}
                      />
                    </div>
                  </div>
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

            <div className="border-t pt-2 space-y-2">
              {!isIncome && (
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium sm:text-sm">ส่วนลด</Label>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      ฿
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="h-8 pl-5 pr-1 text-xs font-medium"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium sm:text-sm">ยอดรวมสุทธิ</Label>
                <span className="text-base font-bold tabular-nums sm:text-lg">
                  ฿{receiptNet.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {!isIncome && discountAmount > 0 && receiptTotal > 0 && (
                <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                  รวมสินค้า ฿{receiptTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} − ส่วนลด ฿{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        )}

        {inputMode === 'standard' && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className={cn(
              'grid gap-3',
              !isIncome ? 'grid-cols-2' : 'grid-cols-1'
            )}>
              {!isIncome && (
                <div className="space-y-1.5">
                  <Label className="text-xs">ส่วนลด (฿)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-9 text-xs"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
              )}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className={cn(!isIncome && 'sm:col-span-1')}>
                    <FormLabel className="text-xs font-semibold text-primary sm:text-sm">
                      {paymentMethod === 'paotang' && !isIncome ? 'ยอดสุทธิ (฿)' : 'จำนวนเงิน (฿)'}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ฿
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="h-9 pl-8 font-semibold border-primary/40 focus-visible:ring-primary"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!isIncome && discountAmount > 0 && (parseFloat(watchedAmount) || 0) > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                ยอดก่อนหักส่วนลด ฿{((parseFloat(watchedAmount) || 0) + discountAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} − ส่วนลด ฿{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )}

        {!isIncome && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">วิธีชำระเงิน</Label>
              <div className="inline-flex gap-0.5 rounded-lg border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('normal')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
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
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    paymentMethod === 'paotang'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  เป๋าตัง
                </button>
              </div>
            </div>

            {paymentMethod === 'paotang' && !splitEnabled && (
              <div className="space-y-1.5">
                <Label className="text-xs">สแกนโดย</Label>
                <div className="inline-flex gap-0.5 rounded-lg border bg-muted/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPaotangPayerMode('self')
                      form.setValue('paidBy', 'Me')
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      paotangPayerMode === 'self'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    ฉันจ่าย
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaotangPayerMode('other')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      paotangPayerMode === 'other'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    เพื่อนจ่ายให้
                  </button>
                </div>
                {paotangPayerMode === 'other' && (
                  <FormField
                    control={form.control}
                    name="paidBy"
                    render={({ field }) => (
                      <FormItem>
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
                )}
              </div>
            )}

            {paymentMethod === 'paotang' && splitEnabled && (
              <p className="text-[10px] text-muted-foreground">
                แบ่งจ่ายเปิดอยู่ — ใส่ยอดสแกนเต็ม หนี้คิดจาก 40%
              </p>
            )}

            {paymentMethod === 'paotang' && (
              <div className="space-y-2">
                <div className="rounded-md border bg-background/80 p-2.5 text-xs space-y-1.5">
                  <p className="text-xs font-medium sm:text-sm">
                    {isOtherPayerPaotang
                      ? `โควต้า ${watchedPaidBy}`
                      : 'โควต้าเป๋าตัง'}
                  </p>
                  <p className="hidden text-[10px] text-muted-foreground sm:block">
                    {isOtherPayerPaotang
                      ? `รัฐจ่ายสูงสุด ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}/วัน`
                      : `รวม ฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} · เดือน ฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()} · วัน ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(isOtherPayerPaotang
                      ? [
                          {
                            label: 'วันนี้',
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                      : [
                          {
                            label: 'รวม',
                            used: paotangUsage.totalUsed,
                            max: PAOTANG_TOTAL_QUOTA,
                            remaining:
                              paotangSplit?.remaining.total ??
                              PAOTANG_TOTAL_QUOTA - paotangUsage.totalUsed,
                          },
                          {
                            label: 'เดือน',
                            used: paotangUsage.monthUsed,
                            max: PAOTANG_MONTHLY_QUOTA,
                            remaining:
                              paotangSplit?.remaining.month ??
                              PAOTANG_MONTHLY_QUOTA - paotangUsage.monthUsed,
                          },
                          {
                            label: 'วันนี้',
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                    ).map((q) => (
                      <div key={q.label} className="rounded border bg-muted/30 px-1.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground">{q.label}</p>
                        <p className="font-semibold tabular-nums text-[11px]">
                          ฿{Math.max(0, q.remaining).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-muted-foreground tabular-nums">
                          {q.used.toLocaleString()}/{q.max.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {totalForPayment > 0 && paotangSplit && (
                  <div className="rounded-md border bg-background p-2.5 text-xs space-y-1.5">
                    {isOtherPayerPaotang ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          {watchedPaidBy} จ่ายให้ — คุณคืน {PAOTANG_USER_PERCENT}%
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground">เต็ม</p>
                            <p className="font-semibold tabular-nums text-xs">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">รัฐจ่าย</p>
                            <p className="font-semibold tabular-nums text-xs text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">คุณคืน</p>
                            <p className="font-semibold tabular-nums text-xs text-destructive">
                              ฿{paotangSplit.oweToPayer?.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-[10px] text-warning">
                            โควต้าวันนี้เต็ม — {getPaotangCapReasonLabel(paotangSplit.capReason)}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          รัฐ {PAOTANG_GOV_PERCENT}% · เรา {PAOTANG_USER_PERCENT}%
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground">เต็ม</p>
                            <p className="font-semibold tabular-nums text-xs">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">รัฐจ่าย</p>
                            <p className="font-semibold tabular-nums text-xs text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">เราจ่าย</p>
                            <p className="font-semibold tabular-nums text-xs text-destructive">
                              ฿{paotangSplit.userPaid.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-[10px] text-warning">
                            โควต้าไม่พอ — {getPaotangCapReasonLabel(paotangSplit.capReason)}
                          </p>
                        )}
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
                <FormLabel className="text-xs sm:text-sm">Received From</FormLabel>
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
        ) : (
          <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs sm:text-sm">แบ่งค่าใช้จ่าย</Label>
              <button
                type="button"
                onClick={() => {
                  const next = !splitEnabled
                  setSplitEnabled(next)
                  if (!next) setSplitData(null)
                }}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                  splitEnabled
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {splitEnabled ? 'เปิด' : 'ปิด'}
              </button>
            </div>

            {splitEnabled && splitTotal > 0 && (
              <TransactionSplitSection
                total={splitTotal}
                initialPayers={resolvedInitialSplit?.payers}
                initialShares={resolvedInitialSplit?.shares}
                initialSplitMode={resolvedInitialSplit?.splitMode}
                useEffectivePayerAmounts={paymentMethod === 'paotang'}
                embedded
                onChange={handleSplitChange}
              />
            )}
            {splitEnabled && splitTotal <= 0 && (
              <p className="text-xs text-muted-foreground">กรอกจำนวนเงินก่อน</p>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <Label className="text-xs sm:text-sm">คิดหนี้กับเพื่อน</Label>
              <button
                type="button"
                onClick={() => setDebtTracking((v) => !v)}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                  debtTracking
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {debtTracking ? 'เปิด' : 'ปิด'}
              </button>
            </div>

            {!debtTracking && (
              <p className="text-[10px] text-muted-foreground">
                แค่บันทึกรายการ ไม่สร้างหนี้
              </p>
            )}
            {debtTracking && (
              <p className="text-[10px] text-muted-foreground">
                หนี้ที่ยังไม่จ่ายจะไม่นับในกระแสเงินสด — เมื่อจ่ายคืนในหน้าหนี้จะสร้างธุรกรรมแยก
              </p>
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

        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Date</FormLabel>
                  <FormControl>
                    <Input type="date" className="h-9 w-full text-sm" {...field} />
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
                  <FormLabel className="text-xs sm:text-sm">Time</FormLabel>
                  <FormControl>
                    <Input type="time" className="h-9 w-full text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <OptionalNoteField value={note} onChange={setNote} />

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1 sm:flex-none" disabled={isSubmitting || categoriesLoading}>
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
