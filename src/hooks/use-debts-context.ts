'use client';

import { useContext } from 'react';
import { DebtsContext } from '@/providers/debts-context';

export function useDebts() {
  const ctx = useContext(DebtsContext);
  if (!ctx) {
    throw new Error('useDebts must be used within FinanceDataProvider');
  }
  return ctx;
}
