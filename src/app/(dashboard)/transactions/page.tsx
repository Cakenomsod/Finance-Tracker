'use client'

import * as React from 'react'
import {
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  computeCumulativeBalanceUpToMonth,
  collectMonthsWithData,
  resolveTxCurrency,
  formatMoney,
} from '@/lib/aggregate-transactions'
import { computeTotalLedgerBalanceUpToMonth } from '@/lib/account-balances'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { isAppCurrency, convertCurrency, STATIC_FALLBACK_RATES } from '@/lib/currency'
import { PaymentSource } from '@/lib/firestore-types'
import { useCategories } from '@/hooks/use-categories'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionAiPanel, type TransactionAiPanelHandle } from '@/components/transactions/transaction-ai-panel'
import { DateGroupDividerRow } from '@/components/transactions/date-group-divider'
import { MonthPicker } from '@/components/shared/month-picker'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  useMonthTransition,
} from '@/components/shared/month-transition'
import { TransactionMobileList } from '@/components/transactions/transaction-mobile-list'
import { TransactionEmptyState } from '@/components/transactions/transaction-empty-state'
import { TransactionTableSkeleton } from '@/components/transactions/transaction-list-skeleton'
import { TransactionDetailDialog } from '@/components/transactions/transaction-detail-dialog'
import { TripExpenseDialog } from '@/components/trips/trip-expense-dialog'
import { RecurringDueCard } from '@/components/dashboard/recurring-due-card'
import { FirstRunChecklist } from '@/components/onboarding/first-run-checklist'
import { useTrips } from '@/hooks/use-trips'
import { Transaction, TripExpense } from '@/lib/firestore-types'
import {
  formatTransactionDisplayTime,
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  groupItemsByDate,
  hasMonthData,
  toDateFromFirestore,
} from '@/lib/datetime'
import { shouldIgnoreRowClick } from '@/lib/row-click'
import { MoneyAmount } from '@/components/money-amount'
import { TX_SEARCH_ID, useQuickAdd } from '@/components/quick-add-context'
import { useUndoableDelete } from '@/hooks/use-undoable-delete'
import { IMMICH_ENABLED } from '@/lib/immich/feature'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { isStorageAttachment } from '@/lib/attachments/ids'
import { useLocale } from '@/components/locale-provider'
import { categoryLabel } from '@/lib/default-categories'

const ALL_CATEGORIES = '__all__'

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
  const { accountsEnabled, currency: preferenceCurrency } = useUserSettings()
  const { rates } = useExchangeRates()
  const { activeSources } = usePaymentSources()
  const { openQuickAdd } = useQuickAdd()
  const { pendingIds, scheduleDelete } = useUndoableDelete()
  const { locale, p, t } = useLocale()

  const sourcesById = React.useMemo(() => {
    const map = new Map<string, PaymentSource>()
    for (const s of activeSources) {
      if (s.id) map.set(s.id, s)
    }
    return map
  }, [activeSources])

  const filterCategories = React.useMemo(
    () => [ALL_CATEGORIES, ...categories.map((c) => c.name)],
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
  const [selectedCategory, setSelectedCategory] = React.useState(ALL_CATEGORIES)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
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
  const transactionAiPanelRef = React.useRef<TransactionAiPanelHandle>(null)

  const prefCurrency = isAppCurrency(preferenceCurrency) ? preferenceCurrency : 'THB'
  const effectiveRates = React.useMemo(
    () => ({ ...STATIC_FALLBACK_RATES, ...rates }),
    [rates]
  )

  // Merge legacy transactions and trip expenses (trip rows show only the user's share)
  const allCombined = React.useMemo((): TransactionsPageRow[] => {
    const legacy = transactions
      .filter((tx) => !tx.tripExpenseId)
      .map((tx) => {
      const txCurrency = resolveTxCurrency(tx)
      const effectiveAmount = getTransactionEffectiveAmount(tx)
      const amountInHome = convertCurrency(effectiveAmount, txCurrency, prefCurrency, effectiveRates)
      return {
        id: tx.id!,
        description: tx.description,
        amount: effectiveAmount,
        fullAmount: tx.amount,
        amountThb: amountInHome,
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

      const exCurrency = resolveTxCurrency(ex)
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
        amountThb: convertCurrency(personalAmount, exCurrency, prefCurrency, effectiveRates),
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
        expenseAmountThb: convertCurrency(-personalExpense, exCurrency, prefCurrency, effectiveRates),
      }]
    })

    const combined = [...legacy, ...newExps].filter((row) => !row.id || !pendingIds.has(row.id))
    combined.sort((a, b) => {
      const dateA = a.date?.seconds || 0
      const dateB = b.date?.seconds || 0
      return dateB - dateA
    })
    return combined
  }, [transactions, allTripExpenses, user?.uid, prefCurrency, effectiveRates, pendingIds])

  const handleDelete = React.useCallback(
    (id: string, tx: Transaction | null) => {
      const name = tx?.description?.trim() || p({ th: 'รายการ', en: 'Entry', zh: '记录' })
      const linked = [
        tx &&
          collectImmichAssetIds(tx).some((id) => IMMICH_ENABLED || isStorageAttachment(id)) &&
          p({ th: 'รูปที่แนบ', en: 'attached photos', zh: '附件图片' }),
        (tx?.splitMode && tx.splitMode !== 'solo') &&
          p({ th: 'หนี้ที่เกี่ยวข้อง', en: 'linked debts', zh: '相关债务' }),
      ].filter(Boolean)
      scheduleDelete(id, () => removeTransaction(id, tx), {
        message: linked.length
          ? p({
              th: `ลบ "${name}" แล้ว (รวม${linked.join(' และ ')})`,
              en: `Deleted "${name}" (with ${linked.join(' and ')})`,
              zh: `已删除「${name}」（含${linked.join('和')}）`,
            })
          : p({ th: `ลบ "${name}" แล้ว`, en: `Deleted "${name}"`, zh: `已删除「${name}」` }),
        undoLabel: t('common.undo'),
      })
    },
    [p, t, removeTransaction, scheduleDelete]
  )

  const summaryCombined = React.useMemo(
    () => mergeTransactions(allTransactions, fullTripExpenses, user?.uid, prefCurrency, effectiveRates),
    [allTransactions, fullTripExpenses, user?.uid, prefCurrency, effectiveRates]
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

  const cumulativeBalance = React.useMemo(() => {
    if (accountsEnabled && activeSources.length > 0) {
      return computeTotalLedgerBalanceUpToMonth(
        allTransactions,
        activeSources,
        sourcesById,
        selectedMonth.year,
        selectedMonth.month,
        prefCurrency,
        effectiveRates
      )
    }
    return computeCumulativeBalanceUpToMonth(
      summaryCombined,
      selectedMonth.year,
      selectedMonth.month
    )
  }, [
    accountsEnabled,
    activeSources,
    sourcesById,
    allTransactions,
    summaryCombined,
    selectedMonth,
    prefCurrency,
    effectiveRates,
  ])

  const monthScopedTransactions = React.useMemo(() => {
    return allCombined.filter((t) => {
      const d = toDateFromFirestore(t.date)
      if (!d) return false
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month
    })
  }, [allCombined, selectedMonth])

  const filteredTransactions = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return monthScopedTransactions.filter((t) => {
      const descMatches = !q || t.description?.toLowerCase().includes(q)
      const noteMatches = !q || t.note?.toLowerCase().includes(q)
      const catMatches = !q || t.category?.toLowerCase().includes(q)
      const matchesSearch = !q || descMatches || noteMatches || catMatches
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES || t.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [monthScopedTransactions, searchQuery, selectedCategory])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== ALL_CATEGORIES
  const monthHasData = hasMonthData(monthsWithData, selectedMonth)
  const monthWindowEmpty = monthScopedTransactions.length === 0
  const showLoadOlderHint =
    filteredTransactions.length === 0 &&
    monthHasData &&
    monthWindowEmpty &&
    (hasMoreOlder || loadingOlder)

  // When the month picker jumps to a month not yet in the window, keep loading older pages.
  React.useEffect(() => {
    if (loading || loadingOlder || !hasMoreOlder) return
    if (!monthHasData) return
    if (monthScopedTransactions.length > 0) return
    void loadOlder()
  }, [
    loading,
    loadingOlder,
    hasMoreOlder,
    monthHasData,
    monthScopedTransactions.length,
    loadOlder,
  ])

  const dateGroupedTransactions = React.useMemo(
    () =>
      groupItemsByDate(filteredTransactions, (transaction) =>
        toDateFromFirestore(transaction.date)
      ),
    [filteredTransactions]
  )

  const handleClearFilters = React.useCallback(() => {
    setSearchQuery('')
    setSelectedCategory(ALL_CATEGORIES)
  }, [])

  const emptyVariant = !allCombined.length
    ? 'no-data'
    : showLoadOlderHint
      ? 'filtered-load-older'
      : monthWindowEmpty
        ? 'no-month-data'
        : 'no-results'

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
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {t('nav.transactions')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {p({
            th: 'รายรับรายจ่ายทั้งหมด กด + เพื่อจดรายการใหม่',
            en: 'All your income and spending. Tap + to log a new entry.',
            zh: '所有收支记录，点 + 添加新记录',
          })}
        </p>
      </div>

      <FirstRunChecklist hasEntries={summaryCombined.length > 0} />

      <RecurringDueCard />

      <TransactionAiPanel
        ref={transactionAiPanelRef}
        onOpenDraftForm={(draft, immichIds) => {
          openQuickAdd({
            draft,
            immichAssetIds: immichIds,
            onSaved: () => transactionAiPanelRef.current?.completeActiveJob(),
          })
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id={TX_SEARCH_ID}
              type="search"
              placeholder={p({ th: 'ค้นหารายการ...', en: 'Search entries...', zh: '搜索记录...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label={p({ th: 'ค้นหารายการ', en: 'Search entries', zh: '搜索记录' })}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger
              className="w-full sm:w-[180px]"
              aria-label={p({ th: 'กรองตามหมวดหมู่', en: 'Filter by category', zh: '按类别筛选' })}
            >
              <Filter className="mr-2 size-4 shrink-0" aria-hidden />
              <SelectValue placeholder={t('tx.category')} />
            </SelectTrigger>
            <SelectContent>
              {filterCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === ALL_CATEGORIES
                    ? p({ th: 'ทุกหมวดหมู่', en: 'All categories', zh: '全部类别' })
                    : categoryLabel(category, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleClearFilters}
            >
              {p({ th: 'ล้างตัวกรอง', en: 'Clear filters', zh: '清除筛选' })}
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setEditingTransaction(null)
        }}
      >
        <DialogContent
          className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[560px] sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>{p({ th: 'แก้ไขรายการ', en: 'Edit entry', zh: '编辑记录' })}</DialogTitle>
            <DialogDescription>
              {p({
                th: 'แก้แล้วกดบันทึก หนี้ที่เกี่ยวข้องจะอัปเดตตาม',
                en: 'Save to apply — linked debts update automatically',
                zh: '保存后相关债务会自动更新',
              })}
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <TransactionForm
              key={editingTransaction.id}
              initialData={editingTransaction}
              currency={preferenceCurrency}
              onSubmit={async (data) => {
                await editTransaction(editingTransaction.id!, data)
                setIsEditDialogOpen(false)
                setEditingTransaction(null)
              }}
              onCancel={() => {
                setIsEditDialogOpen(false)
                setEditingTransaction(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky month summary — single card, hairline cell dividers, no nested metric cards */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="mb-3 flex justify-center border-b border-border pb-3">
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
          className="duration-200 ease-out"
        >
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div
                className="grid grid-cols-2 sm:grid-cols-4"
                role="group"
                aria-label="สรุปยอดเดือนที่เลือก"
              >
                <div className="min-w-0 space-y-1 border-b border-r border-border px-3 py-3 sm:border-b-0 sm:px-4 sm:py-3.5">
                  <p className="text-xs font-medium text-muted-foreground">รายรับรวม</p>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-income`}
                    className="block truncate text-lg font-semibold tabular-nums text-success duration-200 ease-out sm:text-xl"
                  >
                    +{formatMoney(summaryTotals.income, prefCurrency)}
                  </MonthAnimatedValue>
                </div>
                <div className="min-w-0 space-y-1 border-b border-border px-3 py-3 sm:border-b-0 sm:border-r sm:px-4 sm:py-3.5">
                  <p className="text-xs font-medium text-muted-foreground">รายจ่ายรวม</p>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-expenses`}
                    className="block truncate text-lg font-semibold tabular-nums text-destructive duration-200 ease-out sm:text-xl"
                  >
                    -{formatMoney(summaryTotals.expenses, prefCurrency)}
                  </MonthAnimatedValue>
                </div>
                <div className="min-w-0 space-y-1 border-r border-border px-3 py-3 sm:px-4 sm:py-3.5">
                  <p className="text-xs font-medium text-muted-foreground">ยอดสุทธิเดือนนี้</p>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-net`}
                    className={cn(
                      'block truncate text-lg font-semibold tabular-nums duration-200 ease-out sm:text-xl',
                      amountColorClass(summaryTotals.net, 'text-foreground')
                    )}
                  >
                    {formatMoney(summaryTotals.net, prefCurrency, true)}
                  </MonthAnimatedValue>
                </div>
                <div className="min-w-0 space-y-1 px-3 py-3 sm:px-4 sm:py-3.5">
                  <p className="text-xs font-medium text-muted-foreground">เงินสะสมทั้งหมด</p>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-balance`}
                    className={cn(
                      'block truncate text-lg font-semibold tabular-nums duration-200 ease-out sm:text-xl',
                      amountColorClass(cumulativeBalance, 'text-foreground')
                    )}
                  >
                    {formatMoney(cumulativeBalance, prefCurrency)}
                  </MonthAnimatedValue>
                  <p className="text-xs leading-tight text-muted-foreground">
                    {accountsEnabled
                      ? 'ยอดรวมทุกบัญชี · เงินเริ่มต้น + รายการที่ระบุบัญชี'
                      : 'สะสมถึงสิ้นเดือนนี้ · จากทุกรายการ'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MonthContentTransition>
      </div>

      <div
        className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span>
          {loading
            ? 'กำลังโหลด…'
            : `${filteredTransactions.length.toLocaleString()} รายการในเดือนนี้`}
          {hasActiveFilters ? ' (กรองแล้ว)' : ''}
        </span>
      </div>

      <TransactionMobileList
        transactions={filteredTransactions}
        loading={loading}
        categoryByName={categoryByName}
        hasAnyData={allCombined.length > 0}
        hasActiveFilters={hasActiveFilters}
        showLoadOlderHint={showLoadOlderHint}
        emptyVariant={emptyVariant}
        preferenceCurrency={preferenceCurrency}
        rates={effectiveRates}
        onView={handleViewTransaction}
        onEdit={(tx) => {
          setEditingTransaction(tx)
          setIsEditDialogOpen(true)
        }}
        onDelete={handleDelete}
        onAddClick={() => openQuickAdd()}
        onClearFilters={handleClearFilters}
      />

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[72px] text-xs font-semibold">เวลา</TableHead>
                <TableHead className="text-xs font-semibold">รายละเอียด</TableHead>
                <TableHead className="text-xs font-semibold">หมวดหมู่</TableHead>
                <TableHead className="text-xs font-semibold">ผู้จ่าย</TableHead>
                <TableHead className="text-right text-xs font-semibold">จำนวนเงิน</TableHead>
                <TableHead className="w-[44px]">
                  <span className="sr-only">การดำเนินการ</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TransactionTableSkeleton />
              ) : filteredTransactions.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <TransactionEmptyState
                      variant={emptyVariant}
                      onAddClick={() => openQuickAdd()}
                      onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : dateGroupedTransactions.map((group) => (
                <React.Fragment key={group.dateKey}>
                  <DateGroupDividerRow label={group.label} colSpan={6} />
                  {group.items.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className="group cursor-pointer transition-colors duration-200 hover:bg-muted/40 focus-within:bg-muted/40 motion-reduce:transition-none"
                  onClick={(e) => {
                    if (shouldIgnoreRowClick(e.target)) return
                    handleViewTransaction(transaction)
                  }}
                >
                  <TableCell className="py-2.5 text-muted-foreground">
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
                  <TableCell className="py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {transaction.description}
                        {transaction.isPaotang && (
                          <Badge variant="outline" className="ml-2 align-middle text-xs border-chart-2/40 text-chart-2">
                            เป๋าตัง
                          </Badge>
                        )}
                        {!transaction.isLegacy && (
                          <Badge variant="outline" className="ml-2 align-middle text-xs">
                            {transaction.isTripDebtPending ? 'ค้างจ่ายทริป' : 'รายจ่ายทริป'}
                          </Badge>
                        )}
                      </p>
                      {transaction.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {transaction.note}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
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
                          {categoryLabel(transaction.category, locale)}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground">
                    {transaction.paidBy === 'Me' || !transaction.paidBy ? 'ฉัน' : transaction.paidBy}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'py-2.5 text-right font-semibold tabular-nums',
                      transaction.isTripDebtPending
                        ? 'text-muted-foreground'
                        : amountColorClass(transaction.amount)
                    )}
                  >
                    {(() => {
                      const recordedCurrency =
                        transaction.rawTx?.currency ??
                        transaction.rawEx?.currency ??
                        'THB'
                      const displayAmount = transaction.amount
                      const fullAmount = transaction.fullAmount ?? transaction.amount
                      return (
                        <>
                          <MoneyAmount
                            amount={displayAmount}
                            currency={recordedCurrency}
                            preferenceCurrency={preferenceCurrency}
                            rates={effectiveRates}
                            showSign
                            forcePreference={!!transaction.rawEx}
                            className="block"
                          />
                          {transaction.isPaotang && Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              เต็ม {fullAmount > 0 ? '+' : ''}{recordedCurrency === 'JPY' ? '¥' : '฿'}{Math.abs(fullAmount).toLocaleString()}
                              {' · '}รัฐ {PAOTANG_GOV_PERCENT}% (ตามโควต้า)
                            </span>
                          )}
                          {!transaction.isLegacy && Math.abs(fullAmount) !== Math.abs(displayAmount) && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              เต็ม {recordedCurrency === 'JPY' ? '¥' : '฿'}{Math.abs(fullAmount).toLocaleString()}
                            </span>
                          )}
                          {transaction.isPaotang && transaction.paotangQuotaCapped && (
                            <span className="block text-xs font-normal text-warning">
                              โควต้าจำกัด — {getPaotangCapReasonLabel(transaction.paotangCapReason)}
                            </span>
                          )}
                          {transaction.isTripDebtPending && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              ยังไม่นับในรายจ่าย — จ่ายคืนในหน้าทริป
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
                          aria-label={`เมนูสำหรับ ${transaction.description}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transaction.isLegacy ? (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setEditingTransaction(transaction.rawTx!)
                              setIsEditDialogOpen(true)
                            }}>
                              <Edit2 className="mr-2 size-4" aria-hidden />
                              {p({ th: 'แก้ไข', en: 'Edit', zh: '编辑' })}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(transaction.id!, transaction.rawTx)}>
                              <Trash2 className="mr-2 size-4" aria-hidden />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => handleViewTransaction(transaction)}>
                            <ExternalLink className="mr-2 size-4" aria-hidden />
                            {p({ th: 'เปิดรายการทริป', en: 'Open trip expense', zh: '打开旅行支出' })}
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

      <div
        ref={loadOlderSentinelRef}
        className="flex h-12 items-center justify-center"
        aria-live="polite"
      >
        {loadingOlder && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
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
    </div>
  )
}
