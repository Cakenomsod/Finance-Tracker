import * as React from 'react'
import { Plus, Minus, ChevronDown } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { OptionalNoteField } from '@/components/shared/optional-note-field'
import { ImmichAttachmentsField } from '@/components/shared/immich-attachments-field'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { legacyReceiptUrl } from '@/lib/attachments/ids'
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
import { useUserSettings } from '@/hooks/use-user-settings'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useMoneyPools } from '@/hooks/use-money-pools'
import { PaymentSourceSelect } from '@/components/accounts/payment-source-select'
import { MoneyPoolSelect } from '@/components/accounts/money-pool-select'
import { useLocale } from '@/components/locale-provider'
import { CurrencySelect } from '@/components/shared/currency-select'
import { currencySymbol, isAppCurrency, type AppCurrency } from '@/lib/currency'
import { useAuth } from '@/hooks/use-auth'
import { readLastUsed, writeLastUsed } from '@/lib/form-memory'
import { categoryLabel, PREFERRED_FIRST_EXPENSE_CATEGORY } from '@/lib/default-categories'
import type { MessageKey } from '@/lib/i18n'

function buildFormSchema(t: (key: MessageKey) => string) {
  return z
    .object({
      amount: z.string().min(1, t('tx.errAmount')),
      type: z.enum(['income', 'expense', 'transfer']),
      category: z.string(),
      description: z.string(),
      date: z.string(),
      time: z.string().min(1, t('tx.errTime')),
      paidBy: z.string().optional(),
      tripId: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.type !== 'transfer' && !values.category.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('tx.errCategory'),
          path: ['category'],
        })
      }
    })
}

type TransactionFormValues = z.infer<ReturnType<typeof buildFormSchema>>

interface TransactionFormProps {
  initialData?: Transaction | null;
  pendingImmichAssetIds?: string[];
  /** Preference currency to use for new transactions. Editing preserves the recorded currency. */
  currency?: string;
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
  currency: currencyProp,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { activeTrips } = useTrips()
  const { categories, expenseCategories, incomeCategories, loading: categoriesLoading } = useCategories()
  const { accountsEnabled, moneyPoolsEnabled, currency: settingsCurrency } = useUserSettings()
  const saveCurrency = currencyProp ?? settingsCurrency ?? 'THB'
  const { activeSources, defaultSource } = usePaymentSources()
  const { activePools } = useMoneyPools()
  const { t, p, locale } = useLocale()
  const { user } = useAuth()
  const uid = user?.uid
  const formSchema = React.useMemo(() => buildFormSchema(t), [t])
  const isNew = !initialData?.id

  const [accountId, setAccountId] = React.useState(initialData?.accountId ?? '')
  const [moneyPoolId, setMoneyPoolId] = React.useState(initialData?.moneyPoolId ?? '')
  const [transferToAccountId, setTransferToAccountId] = React.useState(initialData?.transferToAccountId ?? '')
  const [transferToPoolId, setTransferToPoolId] = React.useState(initialData?.transferToPoolId ?? '')
  // '' = follow the selected account's currency, then the preferred currency.
  const [pickedCurrency, setPickedCurrency] = React.useState<string>(
    isAppCurrency(initialData?.currency)
      ? initialData.currency
      : initialData?.id
        ? saveCurrency
        : ''
  )
  const accountCurrency = activeSources.find((s) => s.id === accountId)?.currency
  const currency: AppCurrency = isAppCurrency(pickedCurrency)
    ? pickedCurrency
    : isAppCurrency(accountCurrency)
      ? accountCurrency
      : isAppCurrency(saveCurrency)
        ? saveCurrency
        : 'THB'
  const sym = currencySymbol(currency)

  React.useEffect(() => {
    // Do not override an AI/manual account with the default (e.g. always Kplus).
    // Only auto-pick default when the form has no account yet and the draft didn't set one.
    if (accountId || !accountsEnabled || initialData?.accountId) return
    const remembered = readLastUsed(uid, 'account')
    if (remembered && activeSources.some((s) => s.id === remembered)) {
      setAccountId(remembered)
      return
    }
    if (defaultSource?.id) setAccountId(defaultSource.id)
  }, [accountId, defaultSource?.id, accountsEnabled, initialData?.accountId, uid, activeSources])

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
      // Income "Received From" uses allowNone — don't default to Me or the select clears to ไม่ระบุ
      paidBy:
        initialData?.type === 'income'
          ? initialData.paidBy || ''
          : initialData?.paidBy || 'Me',
      tripId: initialData?.tripId || 'none',
    },
  })

  const txType = form.watch('type')
  const selectedCategory = form.watch('category')
  const selectedTripId = form.watch('tripId')
  const isIncome = txType === 'income'
  const isTransfer = txType === 'transfer'

  const preferredCategory = React.useCallback(
    (type: 'income' | 'expense'): string | undefined => {
      const names = type === 'income' ? incomeCategoryNames : expenseCategoryNames
      const remembered = readLastUsed(uid, type === 'income' ? 'category:income' : 'category:expense')
      if (remembered && names.includes(remembered)) return remembered
      if (type === 'expense' && names.includes(PREFERRED_FIRST_EXPENSE_CATEGORY)) {
        return PREFERRED_FIRST_EXPENSE_CATEGORY
      }
      return names[0]
    },
    [uid, incomeCategoryNames, expenseCategoryNames]
  )

  React.useEffect(() => {
    if (categoriesLoading || initialData?.category) return
    const type = form.getValues('type')
    if (type === 'transfer') return
    const fallback = preferredCategory(type)
    if (fallback && !form.getValues('category')) {
      form.setValue('category', fallback)
    }
  }, [categoriesLoading, initialData?.category, form, preferredCategory])

  React.useEffect(() => {
    if (categoriesLoading) return
    const fallback = preferredCategory('expense')
    if (!fallback) return
    setReceiptItems((items) => {
      if (!items.some((item) => !item.category)) return items
      return items.map((item) => (item.category ? item : { ...item, category: fallback }))
    })
  }, [categoriesLoading, preferredCategory])

  React.useEffect(() => {
    if (txType === 'income' && selectedCategory && !incomeNameSet.has(selectedCategory)) {
      const fallback = preferredCategory('income')
      if (fallback) form.setValue('category', fallback)
    }
  }, [txType, selectedCategory, incomeNameSet, preferredCategory, form])

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

  /** Cash leaves my pocket now — otherwise pick account/pool when settling on Debts. */
  const showPaymentSourceFields = React.useMemo(() => {
    if (isIncome || isTransfer) return true
    if (paymentMethod === 'paotang' && paotangPayerMode === 'other') return false
    if (splitEnabled) {
      if (!splitData) return false
      return splitData.payers.some((p) => p.userId === 'Me' && (p.amount ?? 0) > 0)
    }
    return !watchedPaidBy || watchedPaidBy === 'Me'
  }, [
    isIncome,
    isTransfer,
    paymentMethod,
    paotangPayerMode,
    splitEnabled,
    splitData,
    watchedPaidBy,
  ])

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
    if (isIncome || isTransfer) return
    if (paymentMethod !== 'paotang' || splitEnabled) return
    if (paotangPayerMode === 'self') {
      form.setValue('paidBy', 'Me')
    }
  }, [isIncome, isTransfer, paymentMethod, paotangPayerMode, splitEnabled, form])

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
      if (isTransfer) {
        const rawAmount = parseFloat(values.amount) || 0
        if (isNaN(rawAmount) || rawAmount <= 0) {
          form.setError('amount', { message: t('tx.errAmount') })
          return
        }
        const hasAccountTransfer = accountId && transferToAccountId && accountId !== transferToAccountId
        const hasPoolTransfer = moneyPoolId && transferToPoolId && moneyPoolId !== transferToPoolId
        const hasAccountToPool = accountId && transferToPoolId && !transferToAccountId
        const hasPoolToAccount = moneyPoolId && transferToAccountId && !transferToPoolId
        if (!hasAccountTransfer && !hasPoolTransfer && !hasAccountToPool && !hasPoolToAccount) {
          form.setError('amount', { message: t('accounts.transferDesc') })
          return
        }
        await onSubmit({
          amount: rawAmount,
          type: 'transfer',
          category: 'Transfer',
          description: values.description || t('accounts.transfer'),
          date: Timestamp.fromDate(parseLocalDateTime(values.date, values.time)),
          paidBy: 'Me',
          splitWith: null,
          tripId: null,
          receiptUrl: null,
          source: initialData?.source || 'manual',
          currency,
          note: note.trim() || undefined,
          accountId: accountId || undefined,
          moneyPoolId: moneyPoolId || undefined,
          transferToAccountId: transferToAccountId || undefined,
          transferToPoolId: transferToPoolId || undefined,
        })
        return
      }

      const disc = isIncome ? 0 : (parseFloat(discount) || 0)
      let rawAmount: number
      if (isReceiptMode) {
        if (disc > 0 && receiptTotal > 0 && disc > receiptTotal) {
          form.setError('amount', {
            message: p({
              th: 'ส่วนลดต้องไม่เกินยอดรวม',
              en: 'Discount cannot exceed the total',
              zh: '折扣不能超过总额',
            }),
          })
          return
        }
        rawAmount = receiptNet
      } else {
        rawAmount = parseFloat(values.amount) || 0
      }

      if (isNaN(rawAmount) || rawAmount <= 0) {
        form.setError('amount', {
          message: isReceiptMode
            ? p({
                th: 'กรุณาเพิ่มรายการใบเสร็จและระบุราคา',
                en: 'Add receipt items with prices',
                zh: '请添加收据项目并填写价格',
              })
            : t('tx.errAmount'),
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
        form.setError('paidBy', { message: t('tx.errPayer') })
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

      const description =
        values.description.trim() || categoryLabel(values.category, locale)

      const transactionData: Omit<Transaction, 'id' | 'createdAt' | 'userId'> = {
        amount: finalAmount,
        type: values.type,
        category: values.category,
        description,
        date: Timestamp.fromDate(parseLocalDateTime(values.date, values.time)),
        paidBy,
        splitWith,
        payers,
        shares,
        splitMode,
        tripId: values.tripId && values.tripId !== 'none' ? values.tripId : null,
        receiptUrl: legacyReceiptUrl(primaryAttachment),
        source: initialData?.source || 'manual',
        currency,
        note: note.trim() || undefined,
        debtTracking: !isIncome ? debtTracking : undefined,
        accountId:
          accountsEnabled && showPaymentSourceFields && accountId ? accountId : undefined,
        moneyPoolId:
          moneyPoolsEnabled && showPaymentSourceFields && moneyPoolId ? moneyPoolId : undefined,
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
      writeLastUsed(uid, isIncome ? 'category:income' : 'category:expense', values.category)
      if (transactionData.accountId) writeLastUsed(uid, 'account', transactionData.accountId)
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

  const typeOptions: { value: 'expense' | 'income' | 'transfer'; label: string }[] = [
    { value: 'expense', label: t('tx.type.expense') },
    { value: 'income', label: t('tx.type.income') },
    ...(accountsEnabled || moneyPoolsEnabled
      ? [{ value: 'transfer' as const, label: t('accounts.transfer') }]
      : []),
  ]

  const handleTypeChange = (val: 'expense' | 'income' | 'transfer') => {
    form.setValue('type', val)
    if (val === 'transfer') {
      form.setValue('category', 'Transfer')
      return
    }
    const current = form.getValues('category')
    if (val === 'expense' && (incomeNameSet.has(current) || current === 'Transfer' || !current)) {
      const fallback = preferredCategory('expense')
      if (fallback) form.setValue('category', fallback)
    }
    if (val === 'income' && (current === 'Transfer' || !current)) {
      const fallback = preferredCategory('income')
      if (fallback) form.setValue('category', fallback)
    }
  }

  const [showMore, setShowMore] = React.useState(() =>
    Boolean(
      initialData &&
        (initialData.discount ||
          initialData.paymentMethod === 'paotang' ||
          initialData.tripId ||
          initialData.note ||
          initialData.items?.length ||
          initialData.immichAssetId ||
          initialData.immichAssetIds?.length)
    ) || Boolean(pendingImmichAssetIds?.length)
  )

  const activeTripName =
    selectedTripId && selectedTripId !== 'none'
      ? activeTrips.find((trip) => trip.id === selectedTripId)?.name
      : undefined
  const moreSummary = [
    isReceiptMode ? t('tx.inputReceipt') : null,
    discountAmount > 0 ? `${t('tx.discount')} ${sym}${discountAmount.toLocaleString()}` : null,
    paymentMethod === 'paotang' ? p({ th: 'เป๋าตัง', en: 'Paotang', zh: 'Paotang' }) : null,
    activeTripName ?? null,
    attachmentIds.length > 0
      ? p({
          th: `${attachmentIds.length} รูป`,
          en: `${attachmentIds.length} ${attachmentIds.length === 1 ? 'photo' : 'photos'}`,
          zh: `${attachmentIds.length} 张图片`,
        })
      : null,
    note.trim() ? p({ th: 'หมายเหตุ', en: 'Note', zh: '备注' }) : null,
  ].filter(Boolean).join(' · ')

  const segmentClass = (on: boolean) =>
    cn(
      'h-9 rounded-md px-3 text-sm font-medium transition-colors',
      on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    )

  const debtToggle = (
    <div className="space-y-1 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="tx-debt-tracking" className="text-sm">{t('tx.debtTracking')}</Label>
        <Switch id="tx-debt-tracking" checked={debtTracking} onCheckedChange={setDebtTracking} />
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        {debtTracking ? t('tx.debtOn') : t('tx.debtOff')}
      </p>
    </div>
  )

  const categoryField = (
    <FormField
      control={form.control}
      name="category"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm">{t('tx.category')}</FormLabel>
          <Select
            onValueChange={(v) => {
              // Radix can emit empty when SelectItems remount while categories load.
              if (!v) return
              field.onChange(v)
            }}
            value={field.value || undefined}
          >
            <FormControl>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={categoriesLoading ? t('tx.loading') : t('tx.category')} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {visibleCategories.map((c) => {
                const cat = categoryByName.get(c)
                const label = categoryLabel(c, locale)
                return (
                  <SelectItem key={c} value={c}>
                    {cat ? `${cat.icon} ${label}` : label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2 sm:py-3">
        <div
          role="group"
          aria-label={t('tx.typeLabel')}
          className={cn(
            'grid gap-1 rounded-lg bg-muted p-1',
            typeOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={txType === opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className={segmentClass(txType === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {!isReceiptMode && (
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">
                  {paymentMethod === 'paotang' && !isIncome && !isTransfer
                    ? t('tx.netAmount')
                    : t('tx.amount')}
                </FormLabel>
                <div className="flex gap-2">
                  <CurrencySelect
                    compact
                    value={currency}
                    onChange={setPickedCurrency}
                    aria-label={t('settings.currency')}
                    className="h-12 shrink-0"
                  />
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      autoFocus={isNew}
                      className="h-12 min-w-0 text-2xl font-semibold tabular-nums md:text-2xl"
                      {...field}
                    />
                  </FormControl>
                </div>
                {!isIncome && discountAmount > 0 && (parseFloat(watchedAmount) || 0) > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {p({ th: 'ยอดก่อนหักส่วนลด', en: 'Before discount', zh: '折前金额' })} {sym}{((parseFloat(watchedAmount) || 0) + discountAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} − {t('tx.discount')} {sym}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isTransfer && isReceiptMode && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">
                {p({ th: 'รายการในใบเสร็จ', en: 'Receipt items', zh: '收据项目' })}
              </h4>
              <CurrencySelect
                compact
                value={currency}
                onChange={setPickedCurrency}
                aria-label={t('settings.currency')}
                className="ml-auto h-9"
              />
            </div>

            <div className="space-y-2.5">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="space-y-1.5 border-b pb-2.5 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder={p({ th: 'ชื่อสินค้า', en: 'Item name', zh: '商品名称' })}
                      aria-label={p({
                        th: `ชื่อสินค้ารายการที่ ${idx + 1}`,
                        en: `Item ${idx + 1} name`,
                        zh: `第 ${idx + 1} 项名称`,
                      })}
                      className="h-9 min-w-0 flex-1 text-sm"
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
                        aria-label={p({
                          th: `ลบรายการที่ ${idx + 1}`,
                          en: `Remove item ${idx + 1}`,
                          zh: `删除第 ${idx + 1} 项`,
                        })}
                        className="size-9 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_6rem] gap-1.5">
                    <Select
                      value={item.category || undefined}
                      onValueChange={(val) => {
                        if (!val) return
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], category: val }
                        setReceiptItems(next)
                      }}
                    >
                      <SelectTrigger className="h-9 w-full text-sm" aria-label={p({
                        th: `หมวดหมู่รายการที่ ${idx + 1}`,
                        en: `Item ${idx + 1} category`,
                        zh: `第 ${idx + 1} 项分类`,
                      })}>
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
                          const label = categoryLabel(c, locale)
                          return (
                            <SelectItem key={c} value={c}>
                              {cat ? `${cat.icon} ${label}` : label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      aria-label={p({
                        th: `ราคารายการที่ ${idx + 1} (${currency})`,
                        en: `Item ${idx + 1} price (${currency})`,
                        zh: `第 ${idx + 1} 项价格（${currency}）`,
                      })}
                      className="h-9 px-2 text-sm font-medium tabular-nums"
                      value={item.price}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx] = { ...next[idx], price: e.target.value }
                        setReceiptItems(next)
                      }}
                    />
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
                  { name: '', category: preferredCategory('expense') || '', price: '' },
                ])
              }
              className="h-9 w-full gap-1 border-dashed text-sm"
            >
              <Plus className="size-3.5" aria-hidden /> {p({ th: 'เพิ่มรายการ', en: 'Add item', zh: '添加项目' })}
            </Button>

            <div className="space-y-2 border-t pt-2">
              {!isIncome && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tx-receipt-discount" className="text-sm">{t('tx.discount')}</Label>
                  <Input
                    id="tx-receipt-discount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-9 w-28 px-2 text-sm font-medium tabular-nums"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {p({ th: 'ยอดรวมสุทธิ', en: 'Net total', zh: '净额合计' })}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {sym}{receiptNet.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {!isIncome && discountAmount > 0 && receiptTotal > 0 && (
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  {p({ th: 'รวมสินค้า', en: 'Items', zh: '商品合计' })} {sym}{receiptTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} − {t('tx.discount')} {sym}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <FormField
                control={form.control}
                name="amount"
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <div className={cn('grid gap-3', !isTransfer && 'sm:grid-cols-2')}>
          {!isTransfer && categoryField}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">{t('tx.description')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={isTransfer ? t('accounts.transfer') : t('tx.descriptionPlaceholder')}
                    className="h-10 text-sm"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isTransfer ? (
          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <p className="text-xs text-muted-foreground">{t('accounts.transferDesc')}</p>
            {accountsEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('accounts.fromAccount')}</Label>
                  <PaymentSourceSelect sources={activeSources} value={accountId} onChange={setAccountId} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('accounts.toAccount')}</Label>
                  <PaymentSourceSelect sources={activeSources} value={transferToAccountId} onChange={setTransferToAccountId} />
                </div>
              </div>
            )}
            {moneyPoolsEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('accounts.fromPool')}</Label>
                  <MoneyPoolSelect pools={activePools} value={moneyPoolId} onChange={setMoneyPoolId} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('accounts.toPool')}</Label>
                  <MoneyPoolSelect pools={activePools} value={transferToPoolId} onChange={setTransferToPoolId} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {showPaymentSourceFields && accountsEnabled && activeSources.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {isIncome ? t('accounts.toAccount') : t('accounts.fromAccount')}
                </Label>
                <PaymentSourceSelect
                  sources={activeSources}
                  value={accountId}
                  onChange={setAccountId}
                  allowNone
                />
              </div>
            )}
            {showPaymentSourceFields && moneyPoolsEnabled && activePools.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t('accounts.selectPool')}</Label>
                <MoneyPoolSelect pools={activePools} value={moneyPoolId} onChange={setMoneyPoolId} allowNone />
              </div>
            )}
            {!showPaymentSourceFields && (accountsEnabled || moneyPoolsEnabled) && (
              <p className="text-xs text-muted-foreground text-pretty rounded-lg border border-dashed px-3 py-2">
                {t('accounts.deferToDebts')}
              </p>
            )}
          </>
        )}

        {isIncome && (
          <FormField
            control={form.control}
            name="paidBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">{t('tx.receivedFrom')}</FormLabel>
                <FormControl>
                  <ContactSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder={t('tx.receivedFromPlaceholder')}
                    allowNone
                    noneLabel={p({ th: 'ไม่ระบุ', en: 'Not specified', zh: '未指定' })}
                    includeMe={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isIncome && !isTransfer && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="tx-split" className="text-sm">{t('tx.split')}</Label>
                <p className="text-xs text-muted-foreground">
                  {splitEnabled ? t('tx.splitOn') : t('tx.splitOff')}
                </p>
              </div>
              <Switch
                id="tx-split"
                checked={splitEnabled}
                onCheckedChange={(next) => {
                  setSplitEnabled(next)
                  if (!next) setSplitData(null)
                }}
              />
            </div>

            {splitEnabled && splitTotal > 0 && (
              <TransactionSplitSection
                total={splitTotal}
                initialPayers={resolvedInitialSplit?.payers}
                initialShares={resolvedInitialSplit?.shares}
                initialSplitMode={resolvedInitialSplit?.splitMode}
                currencySymbol={sym}
                useEffectivePayerAmounts={paymentMethod === 'paotang'}
                embedded
                onChange={handleSplitChange}
              />
            )}
            {splitEnabled && splitTotal <= 0 && (
              <p className="text-xs text-muted-foreground">{t('tx.enterAmountFirst')}</p>
            )}
            {splitEnabled && debtToggle}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">{t('tx.date')}</FormLabel>
                <FormControl>
                  <Input type="date" className="h-10 w-full text-sm" {...field} />
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
                <FormLabel className="text-sm">{t('tx.time')}</FormLabel>
                <FormControl>
                  <Input type="time" className="h-10 w-full text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border">
          <button
            type="button"
            aria-expanded={showMore}
            aria-controls="tx-more-details"
            onClick={() => setShowMore((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/50"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t('tx.moreDetails')}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {moreSummary || t('tx.moreDetailsHint')}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn('size-4 shrink-0 text-muted-foreground transition-transform', showMore && 'rotate-180')}
            />
          </button>

          {showMore && (
            <div id="tx-more-details" className="space-y-4 border-t p-3">
              {!isTransfer && (
                <div className="space-y-1.5">
                  <Label className="text-sm" id="tx-entry-mode">{t('tx.entryMode')}</Label>
                  <div role="group" aria-labelledby="tx-entry-mode" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                    <button
                      type="button"
                      aria-pressed={inputMode === 'standard'}
                      onClick={() => setInputMode('standard')}
                      className={segmentClass(inputMode === 'standard')}
                    >
                      {t('tx.inputStandard')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={inputMode === 'receipt'}
                      onClick={() => setInputMode('receipt')}
                      className={segmentClass(inputMode === 'receipt')}
                    >
                      {t('tx.inputReceipt')}
                    </button>
                  </div>
                </div>
              )}

              {!isIncome && !isTransfer && !isReceiptMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="tx-discount" className="text-sm">{t('tx.discount')} ({sym})</Label>
                  <Input
                    id="tx-discount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-10 w-40 text-sm tabular-nums"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {p({
                      th: 'ใส่ยอดที่จ่ายจริงในช่องจำนวนเงิน ส่วนลดใช้แค่แสดงว่าประหยัดไปเท่าไร',
                      en: 'Enter what you actually paid as the amount. Discount only shows how much you saved.',
                      zh: '金额请填写实际支付的数额，折扣仅用于显示节省了多少。',
                    })}
                  </p>
                </div>
              )}

              {!isIncome && !isTransfer && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm" id="tx-payment-method">{t('tx.paymentMethod')}</Label>
                    <div role="group" aria-labelledby="tx-payment-method" className="inline-grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                      <button
                        type="button"
                        aria-pressed={paymentMethod === 'normal'}
                        onClick={() => setPaymentMethod('normal')}
                        className={segmentClass(paymentMethod === 'normal')}
                      >
                        {p({ th: 'จ่ายปกติ', en: 'Regular', zh: '普通支付' })}
                      </button>
                      <button
                        type="button"
                        aria-pressed={paymentMethod === 'paotang'}
                        onClick={() => setPaymentMethod('paotang')}
                        className={segmentClass(paymentMethod === 'paotang')}
                      >
                        {p({ th: 'เป๋าตัง', en: 'Paotang', zh: 'Paotang' })}
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'paotang' && !splitEnabled && (
                    <div className="space-y-1.5">
                      <Label className="text-sm" id="tx-paotang-payer">
                        {p({ th: 'สแกนโดย', en: 'Scanned by', zh: '扫码人' })}
                      </Label>
                      <div role="group" aria-labelledby="tx-paotang-payer" className="inline-grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                        <button
                          type="button"
                          aria-pressed={paotangPayerMode === 'self'}
                          onClick={() => {
                            setPaotangPayerMode('self')
                            form.setValue('paidBy', 'Me')
                          }}
                          className={segmentClass(paotangPayerMode === 'self')}
                        >
                          {p({ th: 'ฉันจ่าย', en: 'I paid', zh: '我付款' })}
                        </button>
                        <button
                          type="button"
                          aria-pressed={paotangPayerMode === 'other'}
                          onClick={() => setPaotangPayerMode('other')}
                          className={segmentClass(paotangPayerMode === 'other')}
                        >
                          {p({ th: 'เพื่อนจ่ายให้', en: 'A friend paid', zh: '朋友代付' })}
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
                                  placeholder={p({
                                    th: 'เลือกคนที่จ่ายให้',
                                    en: 'Who paid for you?',
                                    zh: '选择代付的人',
                                  })}
                                  includeMe={false}
                                  allowCreate
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {isOtherPayerPaotang && debtToggle}
                    </div>
                  )}

                  {paymentMethod === 'paotang' && splitEnabled && (
                    <p className="text-xs text-muted-foreground">
                      {p({
                        th: 'หารกับเพื่อนอยู่ — ใส่ยอดสแกนเต็ม ระบบคิดหนี้จากส่วนที่จ่ายจริง 40%',
                        en: 'Splitting with friends: enter the full scanned amount. Debts use the 40% actually paid.',
                        zh: '正在与朋友分账：请输入扫码全额，欠款按实际支付的 40% 计算。',
                      })}
                    </p>
                  )}

            {paymentMethod === 'paotang' && (
              <div className="space-y-2">
                <div className="rounded-md border bg-background/80 p-2.5 text-xs space-y-1.5">
                  <p className="text-xs font-medium sm:text-sm">
                    {isOtherPayerPaotang
                      ? p({
                          th: `โควต้า ${watchedPaidBy}`,
                          en: `${watchedPaidBy}'s quota`,
                          zh: `${watchedPaidBy} 的额度`,
                        })
                      : p({ th: 'โควต้าเป๋าตัง', en: 'Paotang quota', zh: 'Paotang 额度' })}
                  </p>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {isOtherPayerPaotang
                      ? p({
                          th: `รัฐจ่ายสูงสุด ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}/วัน`,
                          en: `Gov pays up to ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}/day`,
                          zh: `政府每天最多补贴 ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`,
                        })
                      : p({
                          th: `รวม ฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} · เดือน ฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()} · วัน ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`,
                          en: `Total ฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} · Month ฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()} · Day ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`,
                          zh: `总计 ฿${PAOTANG_TOTAL_QUOTA.toLocaleString()} · 每月 ฿${PAOTANG_MONTHLY_QUOTA.toLocaleString()} · 每天 ฿${PAOTANG_DAILY_GOV_MAX.toLocaleString()}`,
                        })}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(isOtherPayerPaotang
                      ? [
                          {
                            label: p({ th: 'วันนี้', en: 'Today', zh: '今天' }),
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                      : [
                          {
                            label: p({ th: 'รวม', en: 'Total', zh: '总计' }),
                            used: paotangUsage.totalUsed,
                            max: PAOTANG_TOTAL_QUOTA,
                            remaining:
                              paotangSplit?.remaining.total ??
                              PAOTANG_TOTAL_QUOTA - paotangUsage.totalUsed,
                          },
                          {
                            label: p({ th: 'เดือน', en: 'Month', zh: '本月' }),
                            used: paotangUsage.monthUsed,
                            max: PAOTANG_MONTHLY_QUOTA,
                            remaining:
                              paotangSplit?.remaining.month ??
                              PAOTANG_MONTHLY_QUOTA - paotangUsage.monthUsed,
                          },
                          {
                            label: p({ th: 'วันนี้', en: 'Today', zh: '今天' }),
                            used: paotangUsage.dayUsed,
                            max: PAOTANG_DAILY_GOV_MAX,
                            remaining:
                              paotangSplit?.remaining.day ??
                              PAOTANG_DAILY_GOV_MAX - paotangUsage.dayUsed,
                          },
                        ]
                    ).map((q) => (
                      <div key={q.label} className="rounded border bg-muted/30 px-1.5 py-1.5">
                        <p className="text-xs text-muted-foreground">{q.label}</p>
                        <p className="font-semibold tabular-nums text-xs">
                          ฿{Math.max(0, q.remaining).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
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
                        <p className="text-xs text-muted-foreground">
                          {p({
                            th: `${watchedPaidBy} จ่ายให้ — คุณคืน ${PAOTANG_USER_PERCENT}%`,
                            en: `${watchedPaidBy} paid — you pay back ${PAOTANG_USER_PERCENT}%`,
                            zh: `${watchedPaidBy} 代付 — 你需归还 ${PAOTANG_USER_PERCENT}%`,
                          })}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'เต็ม', en: 'Full', zh: '全额' })}</p>
                            <p className="font-semibold tabular-nums text-xs">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'รัฐจ่าย', en: 'Gov pays', zh: '政府补贴' })}</p>
                            <p className="font-semibold tabular-nums text-xs text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'คุณคืน', en: 'You owe', zh: '你需归还' })}</p>
                            <p className="font-semibold tabular-nums text-xs text-destructive">
                              ฿{paotangSplit.oweToPayer?.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-xs text-warning">
                            {p({ th: 'โควต้าวันนี้เต็ม', en: "Today's quota is used up", zh: '今日额度已用完' })} — {getPaotangCapReasonLabel(paotangSplit.capReason)}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {p({
                            th: `รัฐ ${PAOTANG_GOV_PERCENT}% · เรา ${PAOTANG_USER_PERCENT}%`,
                            en: `Gov ${PAOTANG_GOV_PERCENT}% · You ${PAOTANG_USER_PERCENT}%`,
                            zh: `政府 ${PAOTANG_GOV_PERCENT}% · 你 ${PAOTANG_USER_PERCENT}%`,
                          })}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'เต็ม', en: 'Full', zh: '全额' })}</p>
                            <p className="font-semibold tabular-nums text-xs">
                              ฿{totalForPayment.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'รัฐจ่าย', en: 'Gov pays', zh: '政府补贴' })}</p>
                            <p className="font-semibold tabular-nums text-xs text-chart-2">
                              ฿{paotangSplit.subsidy.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{p({ th: 'เราจ่าย', en: 'You pay', zh: '你支付' })}</p>
                            <p className="font-semibold tabular-nums text-xs text-destructive">
                              ฿{paotangSplit.userPaid.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                        </div>
                        {paotangSplit.capped && (
                          <p className="text-xs text-warning">
                            {p({ th: 'โควต้าไม่พอ', en: 'Not enough quota', zh: '额度不足' })} — {getPaotangCapReasonLabel(paotangSplit.capReason)}
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

              {activeTrips.length > 0 && !isTransfer && (
                <FormField
                  control={form.control}
                  name="tripId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">{t('tx.trip')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={t('tx.noTrip')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('tx.noTrip')}</SelectItem>
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

              <OptionalNoteField value={note} onChange={setNote} />
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 -mx-1 gap-2 bg-background px-1 pt-2 pb-1">
          <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="h-10 flex-1 sm:flex-none" disabled={isSubmitting || categoriesLoading}>
            {isSubmitting ? t('common.saving') : t('tx.save')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
