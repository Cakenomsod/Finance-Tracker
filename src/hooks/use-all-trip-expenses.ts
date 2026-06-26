import { useTripsData } from '@/hooks/use-trips-data-context';

export function useAllTripExpenses() {
  const { tripExpenses, loading } = useTripsData();
  return { allTripExpenses: tripExpenses, loading };
}
