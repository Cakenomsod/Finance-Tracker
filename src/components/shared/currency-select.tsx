'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { cn } from '@/lib/utils'

/** Sentinel for "no explicit currency" — Radix Select cannot use an empty value. */
export const CURRENCY_SELECT_NONE = '__none__'

interface CurrencySelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  /** Label for an extra "inherit / default" option; omitted when not set. */
  noneLabel?: string
  compact?: boolean
  'aria-label'?: string
}

export function CurrencySelect({
  value,
  onChange,
  id,
  className,
  noneLabel,
  compact,
  'aria-label': ariaLabel,
}: CurrencySelectProps) {
  return (
    <Select value={value || (noneLabel ? CURRENCY_SELECT_NONE : undefined)} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(compact && 'w-[5.5rem]', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={CURRENCY_SELECT_NONE}>{noneLabel}</SelectItem>}
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {compact ? `${c.code} ${c.symbol}` : `${c.code} · ${c.label} (${c.symbol})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
