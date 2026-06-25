import { Transaction, TripExpense } from '@/lib/firestore-types'
import { getTransactionEffectiveAmount } from '@/lib/transaction-payment'
import { getTripExpenseUserShare } from '@/lib/trip-balance'

export interface CombinedTransaction {
  id?: string
  description: string
  amount: number
  amountThb: number
  category: string
  date: { seconds: number } | null
  paidBy: string
  isLegacy: boolean
  rawTx?: Transaction | null
  rawEx?: TripExpense | null
  note?: string
}

const JPY_TO_THB = 0.22

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
  'var(--muted-foreground)',
]

export const CATEGORY_ICONS: Record<string, string> = {
  'Food & Dining': '🍜',
  Transport: '🚇',
  Shopping: '🛍️',
  Entertainment: '🎬',
  'Bills & Utilities': '📄',
  'Health & Fitness': '💪',
  Income: '💰',
  Other: '📋',
  Others: '📋',
}

export function formatMoney(amount: number, currency = 'THB', showSign = false): string {
  const symbol = currency === 'THB' ? '฿' : currency === 'JPY' ? '¥' : `${currency} `
  const rounded = Math.round(Math.abs(amount))
  const sign = showSign && amount !== 0 ? (amount > 0 ? '+' : '-') : ''
  return `${sign}${symbol}${rounded.toLocaleString()}`
}

export function getDateFromTx(tx: { date: { seconds: number } | null }): Date {
  if (tx.date?.seconds) {
    return new Date(tx.date.seconds * 1000)
  }
  return new Date()
}

export function mergeTransactions(
  transactions: Transaction[],
  allTripExpenses: TripExpense[],
  userId?: string
): CombinedTransaction[] {
  const legacy = transactions
    .filter((tx) => !tx.tripExpenseId)
    .map((tx) => {
    const factor = tx.currency === 'JPY' ? JPY_TO_THB : 1
    const effectiveAmount = getTransactionEffectiveAmount(tx)
    return {
      id: tx.id,
      description: tx.description,
      amount: effectiveAmount,
      amountThb: effectiveAmount * factor,
      category: tx.category,
      date: tx.date,
      paidBy: tx.paidBy || 'Me',
      isLegacy: true,
      rawTx: tx,
      rawEx: null,
      note: tx.note,
    }
  })

  const tripExps = allTripExpenses.flatMap((ex) => {
    const myShare = userId ? getTripExpenseUserShare(ex, userId) : ex.totalAmount
    if (userId && myShare <= 0) return []

    const factor = ex.currency === 'JPY' ? JPY_TO_THB : 1
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
      rawTx: null,
      rawEx: ex,
      note: ex.note,
    }]
  })

  return [...legacy, ...tripExps].sort((a, b) => {
    const dateA = a.date?.seconds || 0
    const dateB = b.date?.seconds || 0
    return dateB - dateA
  })
}

export function filterByTimeRange(transactions: CombinedTransaction[], range: string): CombinedTransaction[] {
  const now = new Date()
  let cutoff: Date

  switch (range) {
    case '1month':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      break
    case '3months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case '6months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case '1year':
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    default:
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  }

  return transactions.filter((tx) => getDateFromTx(tx) >= cutoff)
}

export function filterCurrentMonth(transactions: CombinedTransaction[]): CombinedTransaction[] {
  const now = new Date()
  return transactions.filter((tx) => {
    const d = getDateFromTx(tx)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
}

export function filterPreviousMonth(transactions: CombinedTransaction[]): CombinedTransaction[] {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  return transactions.filter((tx) => {
    const d = getDateFromTx(tx)
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear
  })
}

export function buildMonthlyOverview(transactions: CombinedTransaction[]) {
  const monthMap = new Map<string, { income: number; expenses: number }>()

  transactions.forEach((tx) => {
    const d = getDateFromTx(tx)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    if (!monthMap.has(key)) {
      monthMap.set(key, { income: 0, expenses: 0 })
    }
    const entry = monthMap.get(key)!
    if (tx.amountThb > 0) {
      entry.income += tx.amountThb
    } else {
      entry.expenses += Math.abs(tx.amountThb)
    }
  })

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const monthIndex = parseInt(key.split('-')[1], 10) - 1
      return {
        month: MONTH_NAMES[monthIndex],
        income: Math.round(data.income),
        expenses: Math.round(data.expenses),
        savings: Math.round(data.income - data.expenses),
      }
    })
}

export function buildCategoryBreakdown(transactions: CombinedTransaction[]) {
  const catMap = new Map<string, number>()

  transactions
    .filter((tx) => tx.amountThb < 0)
    .forEach((tx) => {
      const cat = tx.category || 'Others'
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amountThb))
    })

  const totalExpenses = Array.from(catMap.values()).reduce((s, v) => s + v, 0)

  return Array.from(catMap.entries())
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      color: '',
      percentage: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((cat, index) => ({
      ...cat,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
}

export function buildWeekdaySpending(transactions: CombinedTransaction[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const thisWeekSums = new Array(7).fill(0)

  transactions
    .filter((tx) => tx.amountThb < 0)
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      if (d >= startOfWeek) {
        thisWeekSums[d.getDay()] += Math.abs(tx.amountThb)
      }
    })

  const ordered = [1, 2, 3, 4, 5, 6, 0]
  return ordered.map((idx) => ({
    day: dayNames[idx],
    amount: Math.round(thisWeekSums[idx]),
  }))
}

export function getWeekSpendingComparison(transactions: CombinedTransaction[]) {
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - now.getDay())
  startOfThisWeek.setHours(0, 0, 0, 0)

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  let thisWeek = 0
  let lastWeek = 0

  transactions
    .filter((tx) => tx.amountThb < 0)
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      const amount = Math.abs(tx.amountThb)
      if (d >= startOfThisWeek) {
        thisWeek += amount
      } else if (d >= startOfLastWeek && d < startOfThisWeek) {
        lastWeek += amount
      }
    })

  return computePercentChange(thisWeek, lastWeek)
}

export function getFinancialHabits(transactions: CombinedTransaction[]) {
  const expenseTxs = transactions.filter((tx) => tx.amountThb < 0)
  const totalExpenses = expenseTxs.reduce((s, tx) => s + Math.abs(tx.amountThb), 0)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentExpenses = expenseTxs.filter((tx) => getDateFromTx(tx) >= thirtyDaysAgo)
  const recentTotal = recentExpenses.reduce((s, tx) => s + Math.abs(tx.amountThb), 0)
  const avgDaily = recentExpenses.length > 0 ? Math.round(recentTotal / 30) : 0

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daySums = new Array(7).fill(0)
  let weekdayTotal = 0
  let weekendTotal = 0

  expenseTxs.forEach((tx) => {
    const d = getDateFromTx(tx)
    const day = d.getDay()
    const amount = Math.abs(tx.amountThb)
    daySums[day] += amount
    if (day === 0 || day === 6) {
      weekendTotal += amount
    } else {
      weekdayTotal += amount
    }
  })

  const highestDayIdx = daySums.indexOf(Math.max(...daySums))
  const highestDay = daySums[highestDayIdx] > 0 ? dayNames[highestDayIdx] : '-'

  const catMap = new Map<string, number>()
  expenseTxs.forEach((tx) => {
    const cat = tx.category || 'Others'
    catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amountThb))
  })

  let topCategory = '-'
  let topCategoryPct = 0
  let topCategoryAmount = 0
  if (catMap.size > 0) {
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
    topCategory = sorted[0][0]
    topCategoryAmount = sorted[0][1]
    topCategoryPct = totalExpenses > 0 ? Math.round((sorted[0][1] / totalExpenses) * 100) : 0
  }

  const weekendAvg = weekendTotal / 2
  const weekdayAvg = weekdayTotal / 5
  const weekendMultiplier = weekdayAvg > 0 ? Math.round((weekendAvg / weekdayAvg) * 10) / 10 : 0

  return {
    avgDaily,
    highestDay,
    topCategory,
    topCategoryPct,
    topCategoryAmount,
    txCount: transactions.length,
    weekendMultiplier,
    weekdayTotal: Math.round(weekdayTotal),
    weekendTotal: Math.round(weekendTotal),
  }
}

export function computeMonthTotals(transactions: CombinedTransaction[]) {
  let income = 0
  let expenses = 0
  transactions.forEach((tx) => {
    if (tx.amountThb > 0) {
      income += tx.amountThb
    } else {
      expenses += Math.abs(tx.amountThb)
    }
  })
  const net = income - expenses
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0
  return {
    income: Math.round(income),
    expenses: Math.round(expenses),
    net: Math.round(net),
    savingsRate,
  }
}

export function computePercentChange(
  current: number,
  previous: number
): { value: string; type: 'positive' | 'negative' | 'neutral' } {
  if (previous === 0 && current === 0) {
    return { value: '0%', type: 'neutral' }
  }
  if (previous === 0) {
    return { value: 'New', type: 'positive' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const sign = pct > 0 ? '+' : ''
  return {
    value: `${sign}${pct}%`,
    type: pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral',
  }
}

export interface DashboardInsight {
  type: 'alert' | 'pattern' | 'tip'
  text: string
}

export function buildDashboardInsights(
  currentMonth: CombinedTransaction[],
  habits: ReturnType<typeof getFinancialHabits>
): DashboardInsight[] {
  const insights: DashboardInsight[] = []
  const { income, expenses, savingsRate } = computeMonthTotals(currentMonth)

  if (habits.topCategory !== '-' && habits.topCategoryPct >= 30) {
    insights.push({
      type: 'alert',
      text: `You spent ${habits.topCategoryPct}% of your expenses on ${habits.topCategory} this month.`,
    })
  }

  if (habits.weekendMultiplier >= 1.5) {
    insights.push({
      type: 'pattern',
      text: `Your weekend spending is typically ${habits.weekendMultiplier}x higher than weekdays.`,
    })
  } else if (habits.highestDay !== '-') {
    insights.push({
      type: 'pattern',
      text: `${habits.highestDay} is your highest spending day this period.`,
    })
  }

  if (income > 0 && savingsRate < 20) {
    const target = Math.round(expenses * 0.1)
    insights.push({
      type: 'tip',
      text: `Your savings rate is ${savingsRate}%. Reducing expenses by ฿${target.toLocaleString()} could help reach 20%.`,
    })
  } else if (expenses > 0 && habits.avgDaily > 0) {
    insights.push({
      type: 'tip',
      text: `You average ฿${habits.avgDaily.toLocaleString()} per day in spending over the last 30 days.`,
    })
  }

  if (insights.length === 0 && currentMonth.length > 0) {
    insights.push({
      type: 'tip',
      text: `You have ${currentMonth.length} transactions this month. Keep tracking to unlock more insights.`,
    })
  }

  return insights.slice(0, 3)
}

export function getCategoryIcon(category: string, amount: number): string {
  if (amount > 0) return '💰'
  return CATEGORY_ICONS[category] || '📋'
}
