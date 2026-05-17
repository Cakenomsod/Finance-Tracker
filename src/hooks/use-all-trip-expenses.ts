import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, or } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Trip, TripExpense } from '@/lib/firestore-types'
import { useAuth } from './use-auth'

export function useAllTripExpenses() {
  const { user } = useAuth()
  const [allTripExpenses, setAllTripExpenses] = useState<TripExpense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setAllTripExpenses([])
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
      const activeTrips = tripSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trip))
      const tripIds = activeTrips.map(t => t.id!)

      if (tripIds.length === 0) {
        setAllTripExpenses([])
        setLoading(false)
        return
      }

      // Firestore 'in' query supports up to 30 items
      const queryTripIds = tripIds.slice(0, 30)

      // 2. Listen to expenses for these trips
      const qExp = query(
        collection(db, 'trip_expenses'),
        where('tripId', 'in', queryTripIds)
      )
      
      const unsubscribeExp = onSnapshot(qExp, (expSnap) => {
        const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as TripExpense))
        setAllTripExpenses(expenses.sort((a, b) => b.date.toMillis() - a.date.toMillis()))
        setLoading(false)
      })

      return () => unsubscribeExp()
    })

    return () => unsubscribeTrips()
  }, [user])

  return { allTripExpenses, loading }
}
