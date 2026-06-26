'use client';

import type { ReactNode } from 'react';
import { DebtsProvider } from '@/providers/debts-context';
import { TransactionsProvider } from '@/providers/transactions-context';
import { TripsDataProvider } from '@/providers/trips-data-context';
import { TripsProvider } from '@/providers/trips-context';

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  return (
    <TransactionsProvider>
      <TripsProvider>
        <TripsDataProvider>
          <DebtsProvider>{children}</DebtsProvider>
        </TripsDataProvider>
      </TripsProvider>
    </TransactionsProvider>
  );
}
