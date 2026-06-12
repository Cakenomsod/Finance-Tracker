'use client';

import * as React from 'react';
import { CreditCard, Plus, Edit2, Trash2, Loader2, Tag } from 'lucide-react';
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
import { useCategories } from '@/hooks/use-categories';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { Category } from '@/lib/firestore-types';
import { DEFAULT_CATEGORY_COLORS } from '@/lib/default-categories';
import { formatMoney } from '@/lib/aggregate-transactions';
import { toast } from 'sonner';

interface CategoryFormState {
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  monthlyBudget: string;
}

const emptyForm = (): CategoryFormState => ({
  name: '',
  icon: '📋',
  color: DEFAULT_CATEGORY_COLORS[0],
  type: 'expense',
  monthlyBudget: '',
});

function categoryToForm(category: Category): CategoryFormState {
  return {
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    monthlyBudget: category.monthlyBudget != null ? String(category.monthlyBudget) : '',
  };
}

function CategoryRow({
  category,
  currency,
  onEdit,
  onDelete,
  t,
}: {
  category: Category;
  currency: string;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  t: (key: Parameters<ReturnType<typeof useLocale>['t']>[0], vars?: Record<string, string>) => string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{category.name}</p>
          <p className="text-sm text-muted-foreground">
            {category.monthlyBudget != null
              ? t('settings.budgetPerMonth', {
                  amount: formatMoney(category.monthlyBudget, currency),
                })
              : t('settings.noBudget')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('settings.editCategory')}
          onClick={() => onEdit(category)}
        >
          <Edit2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={t('settings.deleteCategory')}
          onClick={() => onDelete(category)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function CategoriesSettings() {
  const { categories, expenseCategories, incomeCategories, loading, addCategory, editCategory, removeCategory } =
    useCategories();
  const { currency } = useUserSettings();
  const { t } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [form, setForm] = React.useState<CategoryFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const openCreate = (type: 'income' | 'expense' = 'expense') => {
    setEditing(null);
    setForm({ ...emptyForm(), type });
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm(categoryToForm(category));
    setDialogOpen(true);
  };

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      if (err.message === 'DUPLICATE_CATEGORY') return t('settings.duplicateCategory');
      return err.message;
    }
    return 'Failed to save category';
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('settings.categoryNameRequired'));
      return;
    }
    if (form.monthlyBudget && (Number.isNaN(Number(form.monthlyBudget)) || Number(form.monthlyBudget) < 0)) {
      toast.error(t('settings.invalidBudget'));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        icon: form.icon.trim() || '📋',
        color: form.color,
        type: form.type,
        monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : null,
      };
      if (editing?.id) {
        await editCategory(editing.id, data);
        toast.success(t('settings.categoryUpdated'));
      } else {
        await addCategory({
          name: data.name,
          icon: data.icon,
          color: data.color,
          type: data.type,
          monthlyBudget: data.monthlyBudget ?? undefined,
        });
        toast.success(t('settings.categoryAdded'));
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await removeCategory(deleteTarget.id);
      toast.success(t('settings.categoryDeleted'));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const renderCategoryGroup = (
    title: string,
    items: Category[],
    type: 'income' | 'expense'
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openCreate(type)}>
          <Plus className="size-3" />
          {t('settings.addCategory')}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('settings.noCategories')}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              currency={currency}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {t('settings.categories')}
            </CardTitle>
            <CardDescription>{t('settings.categoriesDesc')}</CardDescription>
          </div>
          <Button size="sm" className="gap-2 shrink-0" onClick={() => openCreate()}>
            <Plus className="size-4" />
            {t('settings.addCategory')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Tag className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t('settings.noCategories')}</p>
              <Button size="sm" className="gap-2" onClick={() => openCreate()}>
                <Plus className="size-4" />
                {t('settings.addCategory')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {renderCategoryGroup(t('settings.expenseCategories'), expenseCategories, 'expense')}
              {renderCategoryGroup(t('settings.incomeCategories'), incomeCategories, 'income')}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('settings.editCategory') : t('settings.addCategory')}
            </DialogTitle>
            <DialogDescription>{t('settings.categoriesDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <div
                className="flex size-12 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${form.color}20` }}
              >
                {form.icon || '📋'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t('settings.categoryPreview')}</p>
                <p className="font-medium truncate">{form.name.trim() || '—'}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {form.type === 'income' ? t('settings.income') : t('settings.expense')}
                </Badge>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category-name">{t('settings.categoryName')}</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('settings.categoryName')}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category-icon">{t('settings.icon')}</Label>
                <Input
                  id="category-icon"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🛒"
                  maxLength={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'income' | 'expense' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t('settings.expense')}</SelectItem>
                    <SelectItem value="income">{t('settings.income')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t('settings.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    className="size-8 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? 'var(--primary)' : 'transparent',
                    }}
                    onClick={() => setForm((f) => ({ ...f, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category-budget">{t('settings.monthlyBudget')}</Label>
              <Input
                id="category-budget"
                type="number"
                min={0}
                step="1"
                value={form.monthlyBudget}
                onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground">{t('settings.noBudget')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                t('settings.saveCategory')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t('settings.deleteCategoryConfirm', { name: deleteTarget.name })
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
                  <Loader2 className="size-4 animate-spin" />
                  {t('settings.deleting')}
                </>
              ) : (
                t('settings.deleteCategory')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
