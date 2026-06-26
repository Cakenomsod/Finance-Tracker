'use client';

import { useContext } from 'react';
import { TripsContext } from '@/providers/trips-context';

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) {
    throw new Error('useTrips must be used within FinanceDataProvider');
  }
  return ctx;
}
