'use client';

import * as React from 'react';
import { CreditCard, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
}

const emptyForm = (): RecurringFormState => ({
  name: '',
  amount: '',
  frequency: 'monthly',
  frequencyInterval: '1',
  nextDate: formatLocalDateInput(new Date()),
  category: '',
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
  };
}

export function RecurringExpensesSettings() {
  const { expenses, loading, addExpense, editExpense, removeExpense } = useRecurringExpenses();
  const { expenseCategories } = useCategories();
  const { currency } = useUserSettings();
  const { locale, t } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RecurringExpense | null>(null);
  const [form, setForm] = React.useState<RecurringFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);

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
    try {
      await removeExpense(deleteTarget.id);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteTarget(null);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {t('settings.recurring')}
            </CardTitle>
            <CardDescription>{t('settings.recurringDesc')}</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" />
            {t('settings.addRecurring')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('settings.noRecurring')}
            </p>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{expense.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {formatFrequencyLabel(expense.frequencyInterval, expense.frequency, locale)}
                      </Badge>
                      <span>
                        {t('settings.next')}: {formatNextDate(expense)}
                      </span>
                      {expense.category && (
                        <span>· {expense.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(expense.amount, currency)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(expense)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('settings.editRecurring') : t('settings.addRecurring')}
            </DialogTitle>
            <DialogDescription>{t('settings.recurringDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t('settings.categoryName')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Netflix"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('settings.amount')}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.nextDate')}</Label>
                <Input
                  type="date"
                  value={form.nextDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('settings.payEvery')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={form.frequencyInterval}
                  onChange={(e) => setForm((f) => ({ ...f, frequencyInterval: e.target.value }))}
                />
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, frequency: v as RecurringFrequencyUnit }))
                  }
                >
                  <SelectTrigger className="flex-1">
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
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t('settings.categories')}</Label>
                <Select
                  value={form.category || 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button
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
              {t('settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('settings.deleteCategory')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
