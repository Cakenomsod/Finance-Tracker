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

  return (
    <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t('accounts.selectPool')} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">{t('accounts.noPool')}</SelectItem>
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
