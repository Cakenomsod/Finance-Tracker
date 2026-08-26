import type { Trip, TripExpense, TripSettlement, Transaction } from '@/lib/firestore-types'
import { convertToHomeCurrency } from '@/lib/trip-currency'
import type { TripCurrencyCode } from '@/lib/tax/countries'

export interface PairwiseTransfer {
  from: string
  to: string
  amount: number
}

export function chunkIds<T>(items: T[], size = 30): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Net balance per member in home currency (positive = owed money back). */
export function calcTripMemberNet(
  trip: Trip,
  expenses: TripExpense[],
  settlements: TripSettlement[],
  legacyTxs: Transaction[],
  currentUserId?: string | null
): Record<string, number> {
  const members = trip.members || []
  const net: Record<string, number> = {}
  members.forEach((m) => {
    net[m] = 0
  })

  const resolve = (key: string) => resolveTripMemberKey(key, members, currentUserId)

  legacyTxs
    .filter((tx) => tx.tripId === trip.id && !tx.tripExpenseId)
    .forEach((tx) => {
      const amount = convertToHomeCurrency(Math.abs(tx.amount), tx.currency as TripCurrencyCode | undefined, trip)
      const payer = resolve(tx.paidBy || members[0]) || members[0]
      const split = tx.splitWith

      if (!split) return

      let involved: string[] = []
      if (split === 'all') {
        involved = members.filter((m) => net[m] !== undefined)
      } else {
        const other = resolve(split)
        involved = [payer, other].filter((m): m is string => !!m && members.includes(m))
      }

      if (involved.length === 0) return
      const share = amount / involved.length

      if (net[payer] !== undefined) net[payer] += amount - share
      involved.forEach((m) => {
        if (m !== payer && net[m] !== undefined) net[m] -= share
      })
    })

  expenses
    .filter((e) => e.tripId === trip.id)
    .forEach((ex) => {
      ex.payers.forEach((p) => {
        const key = resolve(p.userId)
        if (key && net[key] !== undefined) {
          net[key] += convertToHomeCurrency(p.amount, ex.currency, trip)
        }
      })
      ex.shares.forEach((s) => {
        const key = resolve(s.userId)
        if (key && net[key] !== undefined) {
          net[key] -= convertToHomeCurrency(s.amount, ex.currency, trip)
        }
      })
    })

  settlements
    .filter((s) => s.tripId === trip.id)
    .forEach((s) => {
      const from = resolve(s.fromUserId)
      const to = resolve(s.toUserId)
      if (from && net[from] !== undefined) net[from] += s.amount
      if (to && net[to] !== undefined) net[to] -= s.amount
    })

  return net
}

/** Greedy min-transfer: who owes whom and how much. */
export function greedyPairwiseTransfers(net: Record<string, number>): PairwiseTransfer[] {
  const transfers: PairwiseTransfer[] = []
  const balances = Object.keys(net).map((id) => ({ id, balance: net[id] }))
  const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance)
  const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance)

  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(Math.abs(debtors[i].balance), creditors[j].balance)
    if (amount > 0.01) {
      transfers.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: Math.round(amount * 100) / 100,
      })
    }
    debtors[i].balance += amount
    creditors[j].balance -= amount
    if (Math.abs(debtors[i].balance) < 0.01) i++
    if (creditors[j].balance < 0.01) j++
  }

  return transfers
}

export function getPairwiseDebtAmount(
  trip: Trip,
  expenses: TripExpense[],
  settlements: TripSettlement[],
  legacyTxs: Transaction[],
  fromUserId: string,
  toUserId: string,
  currentUserId?: string | null
): number {
  const net = calcTripMemberNet(trip, expenses, settlements, legacyTxs, currentUserId)
  const members = trip.members || []
  const from = resolveTripMemberKey(fromUserId, members, currentUserId) || fromUserId
  const to = resolveTripMemberKey(toUserId, members, currentUserId) || toUserId
  const transfer = greedyPairwiseTransfers(net).find(
    (t) => t.from === from && t.to === to
  )
  return transfer?.amount ?? 0
}

/** Split a repayment across trips that have debt between two people. */
export function allocateSettlementAcrossTrips(
  tripIds: string[],
  trips: Trip[],
  expenses: TripExpense[],
  settlements: TripSettlement[],
  legacyTxs: Transaction[],
  fromUserId: string,
  toUserId: string,
  totalAmount: number,
  currentUserId?: string | null
): Array<{ tripId: string; amount: number }> {
  const debts = tripIds
    .map((tripId) => {
      const trip = trips.find((t) => t.id === tripId)
      if (!trip) return null
      const amount = getPairwiseDebtAmount(
        trip,
        expenses,
        settlements,
        legacyTxs,
        fromUserId,
        toUserId,
        currentUserId
      )
      return amount > 0.01 ? { tripId, debtAmount: amount } : null
    })
    .filter((d): d is { tripId: string; debtAmount: number } => d !== null)
    .sort((a, b) => b.debtAmount - a.debtAmount)

  let remaining = totalAmount
  const result: Array<{ tripId: string; amount: number }> = []

  for (const { tripId, debtAmount } of debts) {
    if (remaining <= 0.01) break
    const pay = Math.min(remaining, debtAmount)
    if (pay > 0.01) {
      result.push({ tripId, amount: Math.round(pay * 100) / 100 })
      remaining -= pay
    }
  }

  if (remaining > 0.01 && debts.length > 0) {
    const last = result[result.length - 1]
    if (last) {
      last.amount = Math.round((last.amount + remaining) * 100) / 100
    } else {
      result.push({ tripId: debts[0].tripId, amount: Math.round(remaining * 100) / 100 })
    }
  }

  if (result.length === 0 && tripIds.length > 0) {
    return [{ tripId: tripIds[0], amount: Math.round(totalAmount * 100) / 100 }]
  }

  return result
}

export function isCurrentUserKey(key: string, userId: string): boolean {
  return key === userId || key.toLowerCase() === 'me'
}

/**
 * Map a payer/settlement id onto the key stored in trip.members.
 * Legacy trips use "Me"; newer ones use the Firebase uid — both must resolve.
 */
export function resolveTripMemberKey(
  key: string,
  members: string[],
  currentUserId?: string | null
): string | null {
  if (!key) return null
  if (members.includes(key)) return key
  const uid = currentUserId || ''
  if (uid && isCurrentUserKey(key, uid)) {
    const match = members.find((m) => isCurrentUserKey(m, uid))
    if (match) return match
  }
  // Key is a Firebase uid but trip still uses literal "Me"
  if (uid && key === uid) {
    const me = members.find((m) => m.toLowerCase() === 'me')
    if (me) return me
  }
  return null
}

/** Current user's key inside trip.members (Me or uid). */
export function getTripSelfMemberKey(
  members: string[],
  currentUserId?: string | null
): string | null {
  if (!currentUserId) {
    return members.find((m) => m.toLowerCase() === 'me') ?? null
  }
  return members.find((m) => isCurrentUserKey(m, currentUserId)) ?? null
}

/** User's personal cost for a trip expense (their share, regardless of reimbursement status). */
export function getTripExpenseUserShare(expense: TripExpense, userId: string): number {
  const entry = expense.shares.find((s) => isCurrentUserKey(s.userId, userId))
  return entry?.amount ?? 0
}

/** Amount the user paid upfront on a trip expense. */
export function getTripExpenseUserPaidAmount(expense: TripExpense, userId: string): number {
  const entry = expense.payers.find((p) => isCurrentUserKey(p.userId, userId))
  return entry?.amount ?? 0
}

/**
 * Personal expense recognized in cash flow: user's share when they paid upfront;
 * zero when someone else paid (debt until a settlement transaction is recorded).
 */
export function getTripExpensePersonalExpenseAmount(
  expense: TripExpense,
  userId: string
): number {
  const share = getTripExpenseUserShare(expense, userId)
  if (share <= 0) return 0
  return getTripExpenseUserPaidAmount(expense, userId) > 0.001 ? share : 0
}

/** Trip expense where the user owes their share but has not paid anyone back yet. */
export function isTripExpensePendingDebt(expense: TripExpense, userId: string): boolean {
  const share = getTripExpenseUserShare(expense, userId)
  if (share <= 0) return false
  return getTripExpenseUserPaidAmount(expense, userId) <= 0.001
}

export interface TripDebtSummary {
  personId: string
  personName: string
  amount: number
  tripIds: string[]
}

/** Aggregate trip debts involving the current user across all trips. */
export function aggregateTripDebtsForUser(
  userId: string,
  trips: Trip[],
  expenses: TripExpense[],
  settlements: TripSettlement[],
  legacyTxs: Transaction[]
): TripDebtSummary[] {
  const globalDebts: Record<string, { amount: number; name: string; trips: Set<string> }> = {}

  trips.forEach((trip) => {
    if (!trip.id) return
    const net = calcTripMemberNet(trip, expenses, settlements, legacyTxs, userId)
    const names: Record<string, string> = {}
    trip.members.forEach((m) => {
      names[m] = trip.memberProfiles?.[m]?.displayName || m
    })

    const transfers = greedyPairwiseTransfers(net)
    transfers.forEach(({ from, to, amount }) => {
      if (isCurrentUserKey(from, userId) && !isCurrentUserKey(to, userId)) {
        if (!globalDebts[to]) {
          globalDebts[to] = { amount: 0, name: names[to] || to, trips: new Set() }
        }
        globalDebts[to].amount -= amount
        globalDebts[to].trips.add(trip.id!)
      } else if (isCurrentUserKey(to, userId) && !isCurrentUserKey(from, userId)) {
        if (!globalDebts[from]) {
          globalDebts[from] = { amount: 0, name: names[from] || from, trips: new Set() }
        }
        globalDebts[from].amount += amount
        globalDebts[from].trips.add(trip.id!)
      }
    })
  })

  return Object.keys(globalDebts)
    .map((personId) => ({
      personId,
      personName: globalDebts[personId].name,
      amount: Math.round(globalDebts[personId].amount * 100) / 100,
      tripIds: Array.from(globalDebts[personId].trips),
    }))
    .filter((d) => Math.abs(d.amount) > 0.01)
}
