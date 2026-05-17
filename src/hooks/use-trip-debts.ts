import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, or } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Trip, TripExpense, TripSettlement } from '@/lib/firestore-types'
import { useAuth } from './use-auth'

export interface TripDebtSummary {
  personId: string
  personName: string
  amount: number // > 0 means they owe you, < 0 means you owe them
  tripIds: string[]
}

export function useTripDebts() {
  const { user } = useAuth()
  const [tripDebts, setTripDebts] = useState<TripDebtSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTripDebts([])
      setLoading(false)
      return
    }

    // 1. Listen to user's trips
    const qTrips = query(
      collection(db, 'trips'),
      or(
        where('createdBy', '==', user.uid),
        where('members', 'array-contains', user.uid)
      )
    )

    const unsubscribeTrips = onSnapshot(qTrips, (tripSnap) => {
      const activeTrips = tripSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Trip))
      
      const tripIds = activeTrips.map(t => t.id!)

      if (tripIds.length === 0) {
        setTripDebts([])
        setLoading(false)
        return
      }

      // Firestore 'in' query supports up to 30 items
      // If a user has >30 trips, we'd need to chunk. For now, take first 30.
      const queryTripIds = tripIds.slice(0, 30)

      // 2. Listen to expenses for these trips
      const qExp = query(
        collection(db, 'trip_expenses'),
        where('tripId', 'in', queryTripIds)
      )
      
      const unsubscribeExp = onSnapshot(qExp, (expSnap) => {
        const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as TripExpense))
        
        // 3. Listen to settlements for these trips
        const qSettlements = query(
          collection(db, 'trip_settlements'),
          where('tripId', 'in', queryTripIds)
        )

        const unsubscribeSet = onSnapshot(qSettlements, (setSnap) => {
          const settlements = setSnap.docs.map(d => ({ id: d.id, ...d.data() } as TripSettlement))

          // Compute balances
          // For each expense, calculate who paid and who owes
          const netBalances: Record<string, { amount: number, tripIds: Set<string>, name: string }> = {}

          // Helper to init netBalance
          const init = (userId: string, name: string) => {
            if (userId === user.uid) return
            if (!netBalances[userId]) netBalances[userId] = { amount: 0, tripIds: new Set(), name }
          }

          expenses.forEach(ex => {
            const trip = activeTrips.find(t => t.id === ex.tripId)
            const getDisplayName = (uid: string) => trip?.memberProfiles?.[uid]?.displayName || uid

            // If I paid, others owe me (positive)
            // If others paid, I owe them (negative)
            const myPaid = ex.payers.find(p => p.userId === user.uid)?.amount || 0
            const myShare = ex.shares.find(s => s.userId === user.uid)?.amount || 0

            // This expense has a total net effect on me:
            const myExpenseNet = myPaid - myShare
            if (myExpenseNet === 0) return // No effect on me

            // To map who I specifically owe or who owes me, we need a greedy approach per expense, 
            // OR simpler: we just calculate everyone's net balance in the trip and then greedy match.
            // Since we need exact person-to-person debts for the Debts page, we MUST use the greedy algorithm per trip.
          })

          const isCurrentUser = (key: string) => {
            return key === user.uid || key.toLowerCase() === 'me'
          }

          // Let's do per-trip greedy calculation
          const globalDebts: Record<string, { amount: number, name: string, trips: Set<string> }> = {}

          activeTrips.forEach(trip => {
            const tripExps = expenses.filter(e => e.tripId === trip.id)
            const tripSets = settlements.filter(s => s.tripId === trip.id)

            const net: Record<string, number> = {}
            const names: Record<string, string> = {}
            
            trip.members.forEach(m => { 
              net[m] = 0 
              names[m] = trip.memberProfiles?.[m]?.displayName || m
            })

            // Add expenses
            tripExps.forEach(ex => {
              ex.payers.forEach(p => { if (net[p.userId] !== undefined) net[p.userId] += p.amount })
              ex.shares.forEach(s => { if (net[s.userId] !== undefined) net[s.userId] -= s.amount })
            })

            // Add settlements
            tripSets.forEach(s => {
              if (net[s.fromUserId] !== undefined) net[s.fromUserId] += s.amount
              if (net[s.toUserId] !== undefined) net[s.toUserId] -= s.amount
            })

            // Greedy min-transfer
            const balances = Object.keys(net).map(k => ({ id: k, name: names[k], balance: net[k] }))
            const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance)
            const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance)

            let i = 0, j = 0
            while (i < debtors.length && j < creditors.length) {
              const amount = Math.min(Math.abs(debtors[i].balance), creditors[j].balance)
              
              const from = debtors[i].id
              const to = creditors[j].id

              // If it involves the current user, record it in globalDebts
              if (isCurrentUser(from)) {
                // I owe someone (negative)
                if (!isCurrentUser(to)) {
                  if (!globalDebts[to]) globalDebts[to] = { amount: 0, name: creditors[j].name, trips: new Set() }
                  globalDebts[to].amount -= amount
                  globalDebts[to].trips.add(trip.id!)
                }
              } else if (isCurrentUser(to)) {
                // Someone owes me (positive)
                if (!isCurrentUser(from)) {
                  if (!globalDebts[from]) globalDebts[from] = { amount: 0, name: debtors[i].name, trips: new Set() }
                  globalDebts[from].amount += amount
                  globalDebts[from].trips.add(trip.id!)
                }
              }

              debtors[i].balance += amount
              creditors[j].balance -= amount
              
              if (Math.abs(debtors[i].balance) < 0.01) i++
              if (creditors[j].balance < 0.01) j++
            }
          })

          // Convert to array
          const finalDebts: TripDebtSummary[] = Object.keys(globalDebts)
            .map(k => ({
              personId: k,
              personName: globalDebts[k].name,
              amount: globalDebts[k].amount,
              tripIds: Array.from(globalDebts[k].trips)
            }))
            .filter(d => Math.abs(d.amount) > 0.01)

          setTripDebts(finalDebts)
          setLoading(false)
        })
        
        return () => unsubscribeSet()
      })

      return () => unsubscribeExp()
    })

    return () => unsubscribeTrips()
  }, [user])

  return { tripDebts, loading }
}
