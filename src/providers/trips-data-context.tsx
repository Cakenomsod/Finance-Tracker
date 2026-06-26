'use client';

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useTrips } from '@/hooks/use-trips-context';
import { db } from '@/lib/firebase';
import type {
  Trip,
  TripExpense,
  TripSettlement,
  Transaction,
} from '@/lib/firestore-types';
import {
  aggregateTripDebtsForUser,
  chunkIds,
  type TripDebtSummary,
} from '@/lib/trip-balance';

export type { TripDebtSummary };

export interface TripBalanceData {
  trips: Trip[];
  expenses: TripExpense[];
  settlements: TripSettlement[];
  legacyTxs: Transaction[];
}

export interface TripsDataContextValue {
  trips: Trip[];
  tripExpenses: TripExpense[];
  tripSettlements: TripSettlement[];
  legacyTripTransactions: Transaction[];
  loading: boolean;
  tripDebts: TripDebtSummary[];
  tripBalanceData: TripBalanceData;
}

export const TripsDataContext = createContext<TripsDataContextValue | null>(null);

export function TripsDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { trips, loading: tripsLoading } = useTrips();
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [tripSettlements, setTripSettlements] = useState<TripSettlement[]>([]);
  const [legacyTripTransactions, setLegacyTripTransactions] = useState<
    Transaction[]
  >([]);
  const [tripDebts, setTripDebts] = useState<TripDebtSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTripExpenses([]);
      setTripSettlements([]);
      setLegacyTripTransactions([]);
      setTripDebts([]);
      setDataLoading(false);
      return;
    }

    if (tripsLoading) {
      return;
    }

    let unsubscribeExp: (() => void) | null = null;
    let unsubscribeSet: (() => void) | null = null;
    let unsubscribeTx: (() => void) | null = null;

    const recompute = (
      activeTrips: Trip[],
      expenses: TripExpense[],
      settlements: TripSettlement[],
      legacyTxs: Transaction[]
    ) => {
      setTripExpenses(expenses);
      setTripSettlements(settlements);
      setLegacyTripTransactions(legacyTxs);
      setTripDebts(
        aggregateTripDebtsForUser(
          user.uid,
          activeTrips,
          expenses,
          settlements,
          legacyTxs
        )
      );
      setDataLoading(false);
    };

    const subscribeTripData = (activeTrips: Trip[]) => {
      unsubscribeExp?.();
      unsubscribeSet?.();
      unsubscribeTx?.();

      const tripIds = activeTrips.map((t) => t.id!).filter(Boolean);
      if (tripIds.length === 0) {
        setTripExpenses([]);
        setTripSettlements([]);
        setLegacyTripTransactions([]);
        setTripDebts([]);
        setDataLoading(false);
        return;
      }

      setDataLoading(true);

      const idChunks = chunkIds(tripIds);
      const expensesByChunk = new Map<string, TripExpense[]>();
      const settlementsByChunk = new Map<string, TripSettlement[]>();
      const legacyTxsByChunk = new Map<string, Transaction[]>();

      const maybeRecompute = () => {
        if (
          expensesByChunk.size < idChunks.length ||
          settlementsByChunk.size < idChunks.length ||
          legacyTxsByChunk.size < idChunks.length
        ) {
          return;
        }
        const expenses = Array.from(expensesByChunk.values()).flat();
        const settlements = Array.from(settlementsByChunk.values()).flat();
        const legacyTxs = Array.from(legacyTxsByChunk.values()).flat();
        recompute(activeTrips, expenses, settlements, legacyTxs);
      };

      const unsubsExp: Array<() => void> = [];
      const unsubsSet: Array<() => void> = [];
      const unsubsTx: Array<() => void> = [];

      idChunks.forEach((chunk) => {
        const chunkKey = chunk.join(',');

        unsubsExp.push(
          onSnapshot(
            query(collection(db, 'trip_expenses'), where('tripId', 'in', chunk)),
            (snap) => {
              expensesByChunk.set(
                chunkKey,
                snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripExpense)
              );
              maybeRecompute();
            },
            () => {
              expensesByChunk.set(chunkKey, []);
              maybeRecompute();
            }
          )
        );

        unsubsSet.push(
          onSnapshot(
            query(
              collection(db, 'trip_settlements'),
              where('tripId', 'in', chunk)
            ),
            (snap) => {
              settlementsByChunk.set(
                chunkKey,
                snap.docs.map(
                  (d) => ({ id: d.id, ...d.data() }) as TripSettlement
                )
              );
              maybeRecompute();
            },
            () => {
              settlementsByChunk.set(chunkKey, []);
              maybeRecompute();
            }
          )
        );

        unsubsTx.push(
          onSnapshot(
            query(collection(db, 'transactions'), where('tripId', 'in', chunk)),
            (snap) => {
              legacyTxsByChunk.set(
                chunkKey,
                snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)
              );
              maybeRecompute();
            },
            () => {
              legacyTxsByChunk.set(chunkKey, []);
              maybeRecompute();
            }
          )
        );
      });

      unsubscribeExp = () => unsubsExp.forEach((u) => u());
      unsubscribeSet = () => unsubsSet.forEach((u) => u());
      unsubscribeTx = () => unsubsTx.forEach((u) => u());
    };

    subscribeTripData(trips);

    return () => {
      unsubscribeExp?.();
      unsubscribeSet?.();
      unsubscribeTx?.();
    };
  }, [user, trips, tripsLoading]);

  const tripBalanceData = useMemo<TripBalanceData>(
    () => ({
      trips,
      expenses: tripExpenses,
      settlements: tripSettlements,
      legacyTxs: legacyTripTransactions,
    }),
    [trips, tripExpenses, tripSettlements, legacyTripTransactions]
  );

  const loading = tripsLoading || dataLoading;

  const value = useMemo<TripsDataContextValue>(
    () => ({
      trips,
      tripExpenses,
      tripSettlements,
      legacyTripTransactions,
      loading,
      tripDebts,
      tripBalanceData,
    }),
    [
      trips,
      tripExpenses,
      tripSettlements,
      legacyTripTransactions,
      loading,
      tripDebts,
      tripBalanceData,
    ]
  );

  return (
    <TripsDataContext.Provider value={value}>{children}</TripsDataContext.Provider>
  );
}
