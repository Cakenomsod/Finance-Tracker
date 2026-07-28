'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ThaiBank, searchThaiBanks } from '@/lib/thai-banks';
import { useLocale } from '@/components/locale-provider';
import { markNestedOverlayActivity } from '@/lib/nested-overlay-guard';

interface BankSearchComboboxProps {
  value: string;
  onChange: (bankCode: string, bank: ThaiBank | undefined) => void;
  disabled?: boolean;
}

export function BankSearchCombobox({ value, onChange, disabled }: BankSearchComboboxProps) {
  const { locale, t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);

  const banks = React.useMemo(() => searchThaiBanks(query), [query]);
  const selected = React.useMemo(
    () => searchThaiBanks('').find((b) => b.code === value),
    [value]
  );

  const label = selected
    ? locale === 'th'
      ? selected.nameTh
      : selected.nameEn
    : t('accounts.selectBank');

  const stopScrollLock = (e: React.WheelEvent | React.TouchEvent) => {
    e.stopPropagation();
    markNestedOverlayActivity();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={stopScrollLock}
        onTouchMove={stopScrollLock}
        onOpenAutoFocus={(e) => {
          // Keep focus in search; avoid Dialog stealing scroll
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement)?.querySelector('input');
          input?.focus();
        }}
      >
        <div className="flex max-h-[min(320px,70dvh)] flex-col overflow-hidden">
          <div className="border-b p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('accounts.searchBank')}
              className="h-9"
              autoComplete="off"
              aria-label={t('accounts.searchBank')}
            />
          </div>
          <div
            ref={listRef}
            role="listbox"
            aria-label={t('accounts.selectBank')}
            className="max-h-[min(260px,55dvh)] overflow-y-auto overscroll-contain touch-pan-y p-1"
            onWheel={stopScrollLock}
            onTouchMove={stopScrollLock}
          >
            {banks.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {t('accounts.noBankFound')}
              </p>
            ) : (
              banks.map((bank) => {
                const isSelected = value === bank.code;
                return (
                  <button
                    key={bank.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isSelected && 'bg-accent/60'
                    )}
                    onClick={() => {
                      onChange(bank.code, bank);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {locale === 'th' ? bank.nameTh : bank.nameEn}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {locale === 'th' ? bank.nameEn : bank.nameTh}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
