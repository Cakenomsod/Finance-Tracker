import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, or } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Trip, TripExpense, TripSettlement, Transaction } from '@/lib/firestore-types'
import { aggregateTripDebtsForUser, chunkIds, type TripDebtSummary } from '@/lib/trip-balance'
import { useAuth } from './use-auth'

export type { TripDebtSummary }

export interface TripBalanceData {
  trips: Trip[]
  expenses: TripExpense[]
  settlements: TripSettlement[]
  legacyTxs: Transaction[]
}

export function useTripDebts() {
  const { user } = useAuth()
  const [tripDebts, setTripDebts] = useState<TripDebtSummary[]>([])
  const [tripBalanceData, setTripBalanceData] = useState<TripBalanceData>({
    trips: [],
    expenses: [],
    settlements: [],
    legacyTxs: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTripDebts([])
      setLoading(false)
      return
    }

    let unsubscribeExp: (() => void) | null = null
    let unsubscribeSet: (() => void) | null = null
    let unsubscribeTx: (() => void) | null = null

    const qTrips = query(
      collection(db, 'trips'),
      or(
        where('createdBy', '==', user.uid),
        where('members', 'array-contains', user.uid)
      )
    )

    const recompute = (
      activeTrips: Trip[],
      expenses: TripExpense[],
      settlements: TripSettlement[],
      legacyTxs: Transaction[]
    ) => {
      setTripBalanceData({ trips: activeTrips, expenses, settlements, legacyTxs })
      setTripDebts(
        aggregateTripDebtsForUser(user.uid, activeTrips, expenses, settlements, legacyTxs)
      )
      setLoading(false)
    }

    const subscribeTripData = (activeTrips: Trip[]) => {
      unsubscribeExp?.()
      unsubscribeSet?.()
      unsubscribeTx?.()

      const tripIds = activeTrips.map((t) => t.id!).filter(Boolean)
      if (tripIds.length === 0) {
        setTripDebts([])
        setLoading(false)
        return
      }

      const idChunks = chunkIds(tripIds)
      const expensesByChunk = new Map<string, TripExpense[]>()
      const settlementsByChunk = new Map<string, TripSettlement[]>()
      const legacyTxsByChunk = new Map<string, Transaction[]>()

      const maybeRecompute = () => {
        if (
          expensesByChunk.size < idChunks.length ||
          settlementsByChunk.size < idChunks.length ||
          legacyTxsByChunk.size < idChunks.length
        ) {
          return
        }
        const expenses = Array.from(expensesByChunk.values()).flat()
        const settlements = Array.from(settlementsByChunk.values()).flat()
        const legacyTxs = Array.from(legacyTxsByChunk.values()).flat()
        recompute(activeTrips, expenses, settlements, legacyTxs)
      }

      const unsubsExp: Array<() => void> = []
      const unsubsSet: Array<() => void> = []
      const unsubsTx: Array<() => void> = []

      idChunks.forEach((chunk) => {
        const chunkKey = chunk.join(',')

        unsubsExp.push(
          onSnapshot(
            query(collection(db, 'trip_expenses'), where('tripId', 'in', chunk)),
            (snap) => {
              expensesByChunk.set(
                chunkKey,
                snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripExpense)
              )
              maybeRecompute()
            },
            () => {
              expensesByChunk.set(chunkKey, [])
              maybeRecompute()
            }
          )
        )

        unsubsSet.push(
          onSnapshot(
            query(collection(db, 'trip_settlements'), where('tripId', 'in', chunk)),
            (snap) => {
              settlementsByChunk.set(
                chunkKey,
                snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripSettlement)
              )
              maybeRecompute()
            },
            () => {
              settlementsByChunk.set(chunkKey, [])
              maybeRecompute()
            }
          )
        )

        unsubsTx.push(
          onSnapshot(
            query(collection(db, 'transactions'), where('tripId', 'in', chunk)),
            (snap) => {
              legacyTxsByChunk.set(
                chunkKey,
                snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)
              )
              maybeRecompute()
            },
            () => {
              legacyTxsByChunk.set(chunkKey, [])
              maybeRecompute()
            }
          )
        )
      })

      unsubscribeExp = () => unsubsExp.forEach((u) => u())
      unsubscribeSet = () => unsubsSet.forEach((u) => u())
      unsubscribeTx = () => unsubsTx.forEach((u) => u())
    }

    const unsubscribeTrips = onSnapshot(qTrips, (tripSnap) => {
      const activeTrips = tripSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip)
      if (activeTrips.length === 0) {
        unsubscribeExp?.()
        unsubscribeSet?.()
        unsubscribeTx?.()
        setTripDebts([])
        setLoading(false)
        return
      }
      subscribeTripData(activeTrips)
    })

    return () => {
      unsubscribeTrips()
      unsubscribeExp?.()
      unsubscribeSet?.()
      unsubscribeTx?.()
    }
  }, [user])

  return { tripDebts, tripBalanceData, loading }
}
