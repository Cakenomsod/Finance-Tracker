'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLocale } from '@/components/locale-provider'
import { PaymentSource, MoneyPool } from '@/lib/firestore-types'
import type { BalanceFilter } from '@/lib/account-balances'

interface BalanceFilterBarProps {
  accountsEnabled: boolean
  moneyPoolsEnabled: boolean
  sources: PaymentSource[]
  pools: MoneyPool[]
  sourceId: string
  poolId: string
  onSourceChange: (id: string) => void
  onPoolChange: (id: string) => void
}

export function BalanceFilterBar({
  accountsEnabled,
  moneyPoolsEnabled,
  sources,
  pools,
  sourceId,
  poolId,
  onSourceChange,
  onPoolChange,
}: BalanceFilterBarProps) {
  const { t } = useLocale()

  if (!accountsEnabled && !moneyPoolsEnabled) return null
  if (accountsEnabled && sources.length === 0 && (!moneyPoolsEnabled || pools.length === 0)) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t('accounts.totalBalance')}>
      {accountsEnabled && sources.length > 0 && (
        <Select value={sourceId} onValueChange={onSourceChange}>
          <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-[150px]" aria-label={t('accounts.filterSource')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('accounts.allSources')}</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id!}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {moneyPoolsEnabled && pools.length > 0 && (
        <Select value={poolId} onValueChange={onPoolChange}>
          <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-[150px]" aria-label={t('accounts.filterPool')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('accounts.allPools')}</SelectItem>
            {pools.map((p) => (
              <SelectItem key={p.id} value={p.id!}>
                {p.icon} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

export function buildBalanceFilterArgs(
  sourceId: string,
  poolId: string,
  sourcesById: Map<string, PaymentSource>
): (BalanceFilter & { sourcesById: Map<string, PaymentSource> }) | undefined {
  const hasSource = sourceId && sourceId !== '__all__'
  const hasPool = poolId && poolId !== '__all__'
  if (!hasSource && !hasPool) return undefined
  return {
    sourceIds: hasSource ? new Set([sourceId]) : undefined,
    poolIds: hasPool ? new Set([poolId]) : undefined,
    sourcesById,
  }
}
