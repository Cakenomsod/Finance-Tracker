'use client';

import { useContext } from 'react';
import { TransactionsContext } from '@/providers/transactions-context';

export function useTransactions() {
  const ctx = useContext(TransactionsContext);
  if (!ctx) {
    throw new Error(
      'useTransactions must be used within FinanceDataProvider'
    );
  }
  return ctx;
}
