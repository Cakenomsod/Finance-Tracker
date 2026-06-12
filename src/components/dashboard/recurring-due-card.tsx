'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, CalendarClock, Check, Loader2, SkipForward } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecurringExpenses } from '@/hooks/use-recurring-expenses';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { formatMoney } from '@/lib/aggregate-transactions';
import {
  getRecurringDueDate,
  getVisibleDueRecurringExpenses,
  isRecurringDue,
  snoozeRecurring,
  startOfLocalDay,
} from '@/lib/recurring-expenses';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function RecurringDueCard() {
  const { expenses, loading, confirmPayment, skipCycle } = useRecurringExpenses();
  const { currency, profile } = useUserSettings();
  const { locale, t } = useLocale();
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [snoozeTick, setSnoozeTick] = React.useState(0);

  const dueExpenses = React.useMemo(() => {
    void snoozeTick;
    return getVisibleDueRecurringExpenses(expenses);
  }, [expenses, snoozeTick]);

  if (loading || dueExpenses.length === 0) return null;

  const formatDueLabel = (expense: (typeof dueExpenses)[number]) => {
    const dueDate = getRecurringDueDate(expense);
    if (!dueDate) return '';

    const today = startOfLocalDay();
    const due = startOfLocalDay(dueDate);

    if (due.getTime() < today.getTime()) {
      return t('dashboard.recurringOverdue');
    }
    if (due.getTime() === today.getTime()) {
      return t('dashboard.recurringDueToday');
    }

    const formatted = dueDate.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    return t('dashboard.recurringDueOn', { date: formatted });
  };

  const handleConfirm = async (expense: (typeof dueExpenses)[number]) => {
    if (!expense.id) return;
    setActionId(expense.id);
    try {
      await confirmPayment(expense, profile?.displayName || 'Me');
      toast.success(t('dashboard.recurringConfirmed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setActionId(null);
    }
  };

  const handleSkip = async (expense: (typeof dueExpenses)[number]) => {
    if (!expense.id) return;
    setActionId(expense.id);
    try {
      await skipCycle(expense);
      toast.success(t('dashboard.recurringSkipped'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to skip cycle');
    } finally {
      setActionId(null);
    }
  };

  const handleSnooze = (expense: (typeof dueExpenses)[number]) => {
    snoozeRecurring(expense);
    setSnoozeTick((n) => n + 1);
  };

  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-lg bg-amber-500/15 p-2">
              <Bell className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            {t('dashboard.recurringDue')}
            <Badge variant="secondary" className="ml-1">
              {dueExpenses.length}
            </Badge>
          </CardTitle>
          <CardDescription>{t('dashboard.recurringDueDesc')}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">{t('dashboard.viewRecurring')}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {dueExpenses.map((expense) => {
          const dueDate = getRecurringDueDate(expense);
          const isOverdue = dueDate ? isRecurringDue(expense) && startOfLocalDay(dueDate).getTime() < startOfLocalDay().getTime() : false;
          const busy = actionId === expense.id;

          return (
            <div
              key={expense.id}
              className="flex flex-col gap-3 rounded-lg border bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{expense.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(expense.amount, currency)}
                  </span>
                  {expense.category && <span>· {expense.category}</span>}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      isOverdue && 'border-destructive/40 text-destructive'
                    )}
                  >
                    <CalendarClock className="mr-1 size-3" />
                    {formatDueLabel(expense)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleSnooze(expense)}
                >
                  {t('dashboard.remindLater')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleSkip(expense)}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <SkipForward className="mr-1 size-3.5" />
                      {t('dashboard.skipCycle')}
                    </>
                  )}
                </Button>
                <Button size="sm" disabled={busy} onClick={() => handleConfirm(expense)}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-1 size-3.5" />
                      {t('dashboard.confirmPaid')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
