'use client';

import * as React from 'react';
import { Repeat, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRecurringExpenses } from '@/hooks/use-recurring-expenses';
import { useCategories } from '@/hooks/use-categories';
import { useUserSettings } from '@/hooks/use-user-settings';
import { usePaymentSources } from '@/hooks/use-payment-sources';
import { PaymentSourceSelect } from '@/components/accounts/payment-source-select';
import { useLocale } from '@/components/locale-provider';
import { RecurringExpense, RecurringFrequencyUnit } from '@/lib/firestore-types';
import { formatMoney } from '@/lib/aggregate-transactions';
import { formatLocalDateInput } from '@/lib/datetime';
import { formatFrequencyLabel, normalizeFrequencyInterval } from '@/lib/recurring-expenses';
import { toast } from 'sonner';

interface RecurringFormState {
  name: string;
  amount: string;
  frequency: RecurringFrequencyUnit;
  frequencyInterval: string;
  nextDate: string;
  category: string;
  accountId: string;
}

const emptyForm = (): RecurringFormState => ({
  name: '',
  amount: '',
  frequency: 'monthly',
  frequencyInterval: '1',
  nextDate: formatLocalDateInput(new Date()),
  category: '',
  accountId: '',
});

function expenseToForm(expense: RecurringExpense): RecurringFormState {
  const date = expense.nextDate?.seconds
    ? new Date(expense.nextDate.seconds * 1000)
    : new Date();
  return {
    name: expense.name,
    amount: String(expense.amount),
    frequency: expense.frequency,
    frequencyInterval: String(normalizeFrequencyInterval(expense.frequencyInterval)),
    nextDate: formatLocalDateInput(date),
    category: expense.category || '',
    accountId: expense.accountId || '',
  };
}

function RecurringSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function RecurringExpensesSettings() {
  const { expenses, loading, addExpense, editExpense, removeExpense } = useRecurringExpenses();
  const { expenseCategories } = useCategories();
  const { currency, accountsEnabled } = useUserSettings();
  const { activeSources } = usePaymentSources();
  const { locale, t } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RecurringExpense | null>(null);
  const [form, setForm] = React.useState<RecurringFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (expense: RecurringExpense) => {
    setEditing(expense);
    setForm(expenseToForm(expense));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount || !form.nextDate) return;
    setSaving(true);
    try {
      const nextDate = Timestamp.fromDate(new Date(`${form.nextDate}T12:00:00`));
      const data = {
        name: form.name.trim(),
        amount: Number(form.amount),
        frequency: form.frequency,
        frequencyInterval: normalizeFrequencyInterval(Number(form.frequencyInterval)),
        nextDate,
        category: form.category || undefined,
        accountId: form.accountId || undefined,
      };
      if (editing?.id) {
        await editExpense(editing.id, data);
      } else {
        await addExpense(data);
      }
      toast.success(t('settings.saved'));
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recurring expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await removeExpense(deleteTarget.id);
      toast.success(t('settings.saved'));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const formatNextDate = (expense: RecurringExpense) => {
    if (!expense.nextDate?.seconds) return '—';
    const date = new Date(expense.nextDate.seconds * 1000);
    return date.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
              <Repeat className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              {t('settings.recurring')}
            </CardTitle>
            <CardDescription>{t('settings.recurringDesc')}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 shrink-0 w-full sm:w-auto"
            onClick={openCreate}
          >
            <Plus className="size-4" aria-hidden />
            {t('settings.addRecurring')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <RecurringSkeleton />
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                <Repeat className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground text-pretty max-w-prose">
                {t('settings.noRecurring')}
              </p>
              <Button type="button" size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                {t('settings.addRecurring')}
              </Button>
            </div>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 motion-reduce:transition-none hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{expense.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs font-medium">
                        {formatFrequencyLabel(expense.frequencyInterval, expense.frequency, locale)}
                      </Badge>
                      <span>
                        {t('settings.next')}: {formatNextDate(expense)}
                      </span>
                      {expense.category ? <span>· {expense.category}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(expense.amount, currency)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={t('settings.editRecurringAria', { name: expense.name })}
                        onClick={() => openEdit(expense)}
                      >
                        <Edit2 className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:text-destructive"
                        aria-label={t('settings.deleteRecurringAria', { name: expense.name })}
                        onClick={() => setDeleteTarget(expense)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('settings.editRecurring') : t('settings.addRecurring')}
            </DialogTitle>
            <DialogDescription>{t('settings.recurringDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="recurring-name">{t('settings.recurringName')}</Label>
              <Input
                id="recurring-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Netflix"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="recurring-amount">{t('settings.amount')}</Label>
                <Input
                  id="recurring-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="recurring-next">{t('settings.nextDate')}</Label>
                <Input
                  id="recurring-next"
                  type="date"
                  value={form.nextDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-interval">{t('settings.payEvery')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="recurring-interval"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className="w-full sm:w-24 tabular-nums"
                  value={form.frequencyInterval}
                  onChange={(e) => setForm((f) => ({ ...f, frequencyInterval: e.target.value }))}
                />
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, frequency: v as RecurringFrequencyUnit }))
                  }
                >
                  <SelectTrigger id="recurring-frequency" className="flex-1" aria-label={t('settings.frequency')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('settings.daily')}</SelectItem>
                    <SelectItem value="weekly">{t('settings.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('settings.monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('settings.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-category">{t('settings.categories')}</Label>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="recurring-category">
                  <SelectValue placeholder={t('settings.noCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('settings.noCategory')}</SelectItem>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {accountsEnabled && activeSources.length > 0 && (
              <div className="grid gap-2">
                <Label>{t('accounts.recurringSource')}</Label>
                <PaymentSourceSelect
                  sources={activeSources}
                  value={form.accountId}
                  onChange={(accountId) => setForm((f) => ({ ...f, accountId }))}
                  allowNone
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t('settings.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                saving ||
                !form.name.trim() ||
                !form.amount ||
                !form.nextDate ||
                !form.frequencyInterval ||
                Number(form.frequencyInterval) < 1
              }
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('settings.saving')}
                </>
              ) : (
                t('settings.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteRecurring')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t('settings.deleteRecurringConfirm', { name: deleteTarget.name })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('settings.deleting')}
                </>
              ) : (
                t('settings.deleteRecurring')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
