'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoneyPool } from '@/lib/firestore-types';
import { useLocale } from '@/components/locale-provider';

const NONE_VALUE = '__none__';

interface MoneyPoolSelectProps {
  pools: MoneyPool[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  disabled?: boolean;
}

export function MoneyPoolSelect({
  pools,
  value,
  onChange,
  placeholder,
  allowNone = true,
  disabled,
}: MoneyPoolSelectProps) {
  const { t } = useLocale();
  // Track user-opened menu so remount clears to ไม่ระบุ are ignored.
  const userOpenedRef = React.useRef(false);

  const matched = value ? pools.find((p) => p.id === value) : undefined;
  // Keep a stable item while pools load / when archived, so Radix does not clear.
  const orphan = value && !matched ? value : null;

  const handleChange = (v: string) => {
    // Radix can emit empty when SelectItems remount (pools loading). Ignore that.
    if (!v) return;
    if (v === NONE_VALUE) {
      if (!userOpenedRef.current && value) return;
      userOpenedRef.current = false;
      onChange('');
      return;
    }
    userOpenedRef.current = false;
    onChange(v);
  };

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={handleChange}
      onOpenChange={(next) => {
        if (next) userOpenedRef.current = true;
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t('accounts.selectPool')} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>{t('accounts.noPool')}</SelectItem>
        )}
        {orphan && (
          <SelectItem value={orphan}>
            <span className="text-muted-foreground">…</span>
          </SelectItem>
        )}
        {pools.map((pool) => (
          <SelectItem key={pool.id} value={pool.id!}>
            <span className="flex items-center gap-2">
              <span aria-hidden>{pool.icon}</span>
              <span>{pool.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
