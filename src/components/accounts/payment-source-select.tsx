'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaymentSource } from '@/lib/firestore-types';
import { getSourceDisplaySubtitle } from '@/lib/account-balances';
import { useLocale } from '@/components/locale-provider';

const NONE_VALUE = '__none__';

interface PaymentSourceSelectProps {
  sources: PaymentSource[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  disabled?: boolean;
}

export function PaymentSourceSelect({
  sources,
  value,
  onChange,
  placeholder,
  allowNone = true,
  disabled,
}: PaymentSourceSelectProps) {
  const { t } = useLocale();
  // Track user-opened menu so remount clears to ไม่ระบุ are ignored.
  const userOpenedRef = React.useRef(false);

  const matched = value ? sources.find((s) => s.id === value) : undefined;
  // Keep a stable item while sources load / when archived, so Radix does not clear.
  const orphan = value && !matched ? value : null;

  const handleChange = (v: string) => {
    // Radix can emit empty when SelectItems remount (sources loading). Ignore that.
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
        <SelectValue placeholder={placeholder ?? t('accounts.selectSource')} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>{t('accounts.noSource')}</SelectItem>
        )}
        {orphan && (
          <SelectItem value={orphan}>
            <span className="font-medium text-muted-foreground">…</span>
          </SelectItem>
        )}
        {sources.map((source) => {
          const subtitle = getSourceDisplaySubtitle(source);
          const typeLabel =
            source.type === 'cash'
              ? t('accounts.typeCash')
              : source.type === 'debit_card'
                ? t('accounts.typeDebit')
                : t('accounts.typeBank');
          return (
            <SelectItem key={source.id} value={source.id!}>
              <span className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{source.name}</span>
                {(subtitle || typeLabel) && (
                  <span className="text-xs text-muted-foreground">
                    {[typeLabel, subtitle].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
