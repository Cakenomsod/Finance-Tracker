'use client';

import { useContext } from 'react';
import { TripsDataContext } from '@/providers/trips-data-context';

export function useTripsData() {
  const ctx = useContext(TripsDataContext);
  if (!ctx) {
    throw new Error('useTripsData must be used within FinanceDataProvider');
  }
  return ctx;
}
