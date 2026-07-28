'use client'

import * as React from 'react'
import Link from 'next/link'
import { Landmark, PiggyBank, Settings, Banknote, CreditCard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLocale } from '@/components/locale-provider'
import { useUserSettings } from '@/hooks/use-user-settings'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { useMoneyPools } from '@/hooks/use-money-pools'
import { useTransactions } from '@/hooks/use-transactions'
import { PaymentSource } from '@/lib/firestore-types'
import {
  computeBalanceDeltas,
  computePoolBalance,
  computePoolBreakdownByAccount,
  computeSourceBalance,
  groupSourcesByBank,
} from '@/lib/account-balances'
import { getBankByCode } from '@/lib/thai-banks'
import { formatMoney } from '@/lib/aggregate-transactions'
import { cn, amountColorClass } from '@/lib/utils'

function AccountsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

export default function AccountsPage() {
  const { t, locale } = useLocale()
  const { accountsEnabled, moneyPoolsEnabled, currency, loading: settingsLoading } = useUserSettings()
  const { activeSources, loading: sourcesLoading } = usePaymentSources()
  const { activePools, loading: poolsLoading } = useMoneyPools()
  const { transactions, loading: txLoading } = useTransactions()

  const [filterBank, setFilterBank] = React.useState<string>('__all__')
  const [filterSource, setFilterSource] = React.useState<string>('__all__')
  const [filterPool, setFilterPool] = React.useState<string>('__all__')

  const sourcesById = React.useMemo(() => {
    const map = new Map<string, PaymentSource>()
    for (const s of activeSources) {
      if (s.id) map.set(s.id, s)
    }
    return map
  }, [activeSources])

  const { accountDeltas, poolDeltas } = React.useMemo(
    () => computeBalanceDeltas(transactions, sourcesById),
    [transactions, sourcesById]
  )

  const ledgerSources = React.useMemo(
    () => activeSources.filter((s) => s.type === 'bank_account' || s.type === 'cash'),
    [activeSources]
  )

  const filteredLedger = React.useMemo(() => {
    return ledgerSources.filter((s) => {
      if (filterBank !== '__all__') {
        if (filterBank === '__cash__') return s.type === 'cash'
        if (s.bankCode !== filterBank) return false
      }
      if (filterSource !== '__all__' && s.id !== filterSource) return false
      return true
    })
  }, [ledgerSources, filterBank, filterSource])

  const totalBalance = React.useMemo(() => {
    if (filterPool !== '__all__') {
      const pool = activePools.find((p) => p.id === filterPool)
      return pool ? computePoolBalance(pool, poolDeltas) : 0
    }
    return filteredLedger.reduce((sum, s) => sum + computeSourceBalance(s, accountDeltas), 0)
  }, [filteredLedger, filterPool, activePools, poolDeltas, accountDeltas])

  const bankGroups = React.useMemo(() => {
    const groups = groupSourcesByBank(
      activeSources.filter((s) => {
        if (filterBank !== '__all__') {
          if (filterBank === '__cash__') return s.type === 'cash'
          return s.bankCode === filterBank || (s.type === 'debit_card' && sourcesById.get(s.linkedSourceId ?? '')?.bankCode === filterBank)
        }
        return true
      })
    )
    return groups
  }, [activeSources, filterBank, sourcesById])

  const bankOptions = React.useMemo(() => {
    const codes = new Set<string>()
    let hasCash = false
    for (const s of activeSources) {
      if (s.type === 'cash') hasCash = true
      else if (s.bankCode) codes.add(s.bankCode)
    }
    return { codes: Array.from(codes), hasCash }
  }, [activeSources])

  const loading = settingsLoading || (accountsEnabled && sourcesLoading) || (moneyPoolsEnabled && poolsLoading) || txLoading
  const featuresOff = !accountsEnabled && !moneyPoolsEnabled

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('accounts.pageDesc')}</p>
        </div>
        <AccountsSkeleton />
      </div>
    )
  }

  if (featuresOff) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('accounts.pageDesc')}</p>
        </div>
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
              <Landmark className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground text-pretty max-w-prose">
              {t('accounts.noAccountsEnabled')}
            </p>
            <Button asChild size="sm">
              <Link href="/settings?tab=money">{t('accounts.goSettings')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sortedBankKeys = Array.from(bankGroups.keys()).sort((a, b) => {
    if (a === '__cash__') return 1
    if (b === '__cash__') return -1
    const nameA = getBankByCode(a)?.[locale === 'th' ? 'nameTh' : 'nameEn'] ?? a
    const nameB = getBankByCode(b)?.[locale === 'th' ? 'nameTh' : 'nameEn'] ?? b
    return nameA.localeCompare(nameB, locale)
  })

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('accounts.pageDesc')}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link href="/settings?tab=money">
            <Settings className="size-4" aria-hidden />
            {t('accounts.goSettings')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {t('accounts.totalBalance')}
          </CardTitle>
          <p
            className={cn(
              'text-3xl font-semibold tabular-nums tracking-tight',
              amountColorClass(totalBalance, 'text-foreground')
            )}
          >
            {formatMoney(totalBalance, currency)}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {accountsEnabled && (
            <>
              <Select value={filterBank} onValueChange={setFilterBank}>
                <SelectTrigger className="w-[160px]" aria-label={t('accounts.filterBank')}>
                  <SelectValue placeholder={t('accounts.filterBank')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('accounts.allBanks')}</SelectItem>
                  {bankOptions.hasCash && (
                    <SelectItem value="__cash__">{t('accounts.typeCash')}</SelectItem>
                  )}
                  {bankOptions.codes.map((code) => {
                    const bank = getBankByCode(code)
                    return (
                      <SelectItem key={code} value={code}>
                        {locale === 'th' ? bank?.nameTh : bank?.nameEn ?? code}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[160px]" aria-label={t('accounts.filterSource')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('accounts.allSources')}</SelectItem>
                  {ledgerSources.map((s) => (
                    <SelectItem key={s.id} value={s.id!}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {moneyPoolsEnabled && activePools.length > 0 && (
            <Select value={filterPool} onValueChange={setFilterPool}>
              <SelectTrigger className="w-[160px]" aria-label={t('accounts.filterPool')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('accounts.allPools')}</SelectItem>
                {activePools.map((p) => (
                  <SelectItem key={p.id} value={p.id!}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {accountsEnabled && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('accounts.byBank')}</h2>
          {activeSources.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground text-pretty">{t('accounts.noSources')}</p>
                <Button asChild size="sm">
                  <Link href="/settings?tab=money">{t('accounts.addBankAccount')}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {sortedBankKeys.map((key) => {
                const sources = bankGroups.get(key) ?? []
                const accounts = sources.filter((s) => s.type === 'bank_account' || s.type === 'cash')
                const debits = sources.filter((s) => s.type === 'debit_card')
                const bank = key !== '__cash__' && key !== '__other__' ? getBankByCode(key) : null
                const groupTitle =
                  key === '__cash__'
                    ? t('accounts.typeCash')
                    : locale === 'th'
                      ? bank?.nameTh ?? key
                      : bank?.nameEn ?? key
                const groupBalance = accounts.reduce(
                  (sum, s) => sum + computeSourceBalance(s, accountDeltas),
                  0
                )

                return (
                  <li key={key}>
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            {key === '__cash__' ? (
                              <Banknote className="size-4 text-muted-foreground" aria-hidden />
                            ) : (
                              <Landmark className="size-4 text-muted-foreground" aria-hidden />
                            )}
                            {groupTitle}
                          </CardTitle>
                          <span
                            className={cn(
                              'text-base font-semibold tabular-nums',
                              amountColorClass(groupBalance, 'text-foreground')
                            )}
                          >
                            {formatMoney(groupBalance, currency)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {accounts.map((acct) => {
                          const bal = computeSourceBalance(acct, accountDeltas)
                          const linkedDebits = debits.filter((d) => d.linkedSourceId === acct.id)
                          return (
                            <div key={acct.id} className="rounded-lg border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{acct.name}</p>
                                  {acct.accountNumber && (
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                      •••• {acct.accountNumber.replace(/\D/g, '').slice(-4)}
                                    </p>
                                  )}
                                </div>
                                <span className="font-semibold tabular-nums shrink-0">
                                  {formatMoney(bal, currency)}
                                </span>
                              </div>
                              {linkedDebits.length > 0 && (
                                <ul className="mt-2 space-y-1 border-t pt-2 list-none p-0 m-0">
                                  {linkedDebits.map((d) => (
                                    <li
                                      key={d.id}
                                      className="flex items-center gap-2 text-sm text-muted-foreground"
                                    >
                                      <CreditCard className="size-3.5 shrink-0" aria-hidden />
                                      <span className="truncate">{d.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {moneyPoolsEnabled && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <PiggyBank className="size-5 text-muted-foreground" aria-hidden />
            {t('accounts.byPool')}
          </h2>
          {activePools.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground text-pretty">{t('accounts.noPools')}</p>
                <Button asChild size="sm">
                  <Link href="/settings?tab=money">{t('accounts.addPool')}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {activePools
                .filter((p) => filterPool === '__all__' || p.id === filterPool)
                .map((pool) => {
                  const bal = computePoolBalance(pool, poolDeltas)
                  const breakdown = pool.id
                    ? computePoolBreakdownByAccount(pool.id, transactions, sourcesById)
                    : []
                  const progress =
                    pool.targetAmount && pool.targetAmount > 0
                      ? Math.min(100, Math.round((bal / pool.targetAmount) * 100))
                      : null

                  return (
                    <li key={pool.id}>
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base flex items-center gap-2 min-w-0">
                              <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
                                style={{ backgroundColor: `${pool.color}20` }}
                                aria-hidden
                              >
                                {pool.icon}
                              </span>
                              <span className="truncate">{pool.name}</span>
                            </CardTitle>
                            <span className="font-semibold tabular-nums shrink-0">
                              {formatMoney(bal, currency)}
                            </span>
                          </div>
                          {pool.targetAmount != null && (
                            <CardDescription className="tabular-nums">
                              {t('accounts.target')}: {formatMoney(pool.targetAmount, currency)}
                              {progress != null ? ` · ${progress}%` : ''}
                            </CardDescription>
                          )}
                        </CardHeader>
                        {progress != null && (
                          <CardContent className="pt-0 pb-3">
                            <div
                              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </CardContent>
                        )}
                        {breakdown.length > 0 && (
                          <CardContent className={cn('pt-0', progress != null && 'pt-0')}>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              {t('accounts.poolBreakdown')}
                            </p>
                            <ul className="space-y-1 list-none p-0 m-0">
                              {breakdown.map((row) => {
                                const src = sourcesById.get(row.accountId)
                                return (
                                  <li
                                    key={row.accountId}
                                    className="flex items-center justify-between gap-2 text-sm"
                                  >
                                    <span className="truncate text-muted-foreground">
                                      {src?.name ?? row.accountId}
                                    </span>
                                    <span className="tabular-nums shrink-0">
                                      {formatMoney(row.amount, currency)}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </CardContent>
                        )}
                      </Card>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
