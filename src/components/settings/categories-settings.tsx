'use client';

import * as React from 'react';
import { Tags, Plus, Edit2, Trash2, Loader2, Tag } from 'lucide-react';
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
import { useCategories } from '@/hooks/use-categories';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { Category } from '@/lib/firestore-types';
import { DEFAULT_CATEGORY_COLORS } from '@/lib/default-categories';
import { formatMoney } from '@/lib/aggregate-transactions';
import { cn } from '@/lib/utils';
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

function CategoriesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
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
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors duration-200 motion-reduce:transition-none hover:bg-muted/40">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${category.color}20` }}
          aria-hidden
        >
          {category.icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{category.name}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
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
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={t('settings.editCategory')}
          onClick={() => onEdit(category)}
        >
          <Edit2 className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-destructive hover:text-destructive"
          aria-label={t('settings.deleteCategory')}
          onClick={() => onDelete(category)}
        >
          <Trash2 className="size-4" aria-hidden />
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
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => openCreate(type)}
        >
          <Plus className="size-3" aria-hidden />
          {t('settings.addCategory')}
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground text-pretty">{t('settings.noCategories')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 gap-2"
            onClick={() => openCreate(type)}
          >
            <Plus className="size-4" aria-hidden />
            {t('settings.addCategory')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {items.map((category) => (
            <li key={category.id}>
              <CategoryRow
                category={category}
                currency={currency}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
              <Tags className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              {t('settings.categories')}
            </CardTitle>
            <CardDescription>{t('settings.categoriesDesc')}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 shrink-0 w-full sm:w-auto"
            onClick={() => openCreate()}
          >
            <Plus className="size-4" aria-hidden />
            {t('settings.addCategory')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CategoriesSkeleton />
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                <Tag className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground text-pretty max-w-prose">
                {t('settings.noCategories')}
              </p>
              <Button type="button" size="sm" className="gap-2" onClick={() => openCreate()}>
                <Plus className="size-4" aria-hidden />
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
                aria-hidden
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
                <Label htmlFor="category-type">{t('settings.type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'income' | 'expense' }))}
                >
                  <SelectTrigger id="category-type">
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
              <Label id="category-color-label">{t('settings.color')}</Label>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby="category-color-label"
              >
                {DEFAULT_CATEGORY_COLORS.map((color) => {
                  const selected = form.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={
                        selected
                          ? t('settings.colorSelected', { color })
                          : t('settings.colorSwatch', { color })
                      }
                      className={cn(
                        'size-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none',
                        selected ? 'border-primary shadow-sm' : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm((f) => ({ ...f, color }))}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category-budget">{t('settings.monthlyBudget')}</Label>
              <Input
                id="category-budget"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={form.monthlyBudget}
                onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))}
                placeholder="5000"
                aria-describedby="category-budget-hint"
                className="tabular-nums"
              />
              <p id="category-budget-hint" className="text-xs text-muted-foreground">
                {t('settings.budgetOptional')}
              </p>
            </div>
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
              disabled={saving || !form.name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
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
                  <Loader2 className="size-4 animate-spin" aria-hidden />
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
