import { useTripsData } from '@/hooks/use-trips-data-context';

export type { TripDebtSummary, TripBalanceData } from '@/providers/trips-data-context';

export function useTripDebts() {
  const { tripDebts, tripBalanceData, loading } = useTripsData();
  return { tripDebts, tripBalanceData, loading };
}
