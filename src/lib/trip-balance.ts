import type { Trip, TripExpense, TripSettlement, Transaction } from '@/lib/firestore-types'
import { convertToHomeCurrency } from '@/lib/trip-currency'

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
  legacyTxs: Transaction[]
): Record<string, number> {
  const members = trip.members || []
  const net: Record<string, number> = {}
  members.forEach((m) => {
    net[m] = 0
  })

  legacyTxs
    .filter((tx) => tx.tripId === trip.id && !tx.tripExpenseId)
    .forEach((tx) => {
      const amount = convertToHomeCurrency(Math.abs(tx.amount), tx.currency, trip)
      const payer = tx.paidBy || members[0]
      const split = tx.splitWith

      if (!split) return

      let involved: string[] = []
      if (split === 'all') {
        involved = members.filter((m) => net[m] !== undefined)
      } else {
        involved = [payer, split].filter((m) => members.includes(m))
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
        if (net[p.userId] !== undefined) {
          net[p.userId] += convertToHomeCurrency(p.amount, ex.currency, trip)
        }
      })
      ex.shares.forEach((s) => {
        if (net[s.userId] !== undefined) {
          net[s.userId] -= convertToHomeCurrency(s.amount, ex.currency, trip)
        }
      })
    })

  settlements
    .filter((s) => s.tripId === trip.id)
    .forEach((s) => {
      if (net[s.fromUserId] !== undefined) net[s.fromUserId] += s.amount
      if (net[s.toUserId] !== undefined) net[s.toUserId] -= s.amount
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
  toUserId: string
): number {
  const net = calcTripMemberNet(trip, expenses, settlements, legacyTxs)
  const transfer = greedyPairwiseTransfers(net).find(
    (t) => t.from === fromUserId && t.to === toUserId
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
  totalAmount: number
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
        toUserId
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

/** User's personal cost for a trip expense (their share, regardless of reimbursement status). */
export function getTripExpenseUserShare(expense: TripExpense, userId: string): number {
  const entry = expense.shares.find((s) => isCurrentUserKey(s.userId, userId))
  return entry?.amount ?? 0
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
    const net = calcTripMemberNet(trip, expenses, settlements, legacyTxs)
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
