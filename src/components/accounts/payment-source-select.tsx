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

  return (
    <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t('accounts.selectSource')} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">{t('accounts.noSource')}</SelectItem>
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
