'use client';

import * as React from 'react';
import { CreditCard, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export function CategoriesSettings() {
  const { categories, loading, addCategory, editCategory, removeCategory } = useCategories();
  const { currency } = useUserSettings();
  const { t } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [form, setForm] = React.useState<CategoryFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm(categoryToForm(category));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        icon: form.icon.trim() || '📋',
        color: form.color,
        type: form.type,
        monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : undefined,
      };
      if (editing?.id) {
        await editCategory(editing.id, data);
      } else {
        await addCategory(data);
      }
      toast.success(t('settings.saved'));
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await removeCategory(deleteTarget.id);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {t('settings.categories')}
            </CardTitle>
            <CardDescription>{t('settings.categoriesDesc')}</CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={openCreate}>
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
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('settings.noCategories')}
            </p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-lg text-lg"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      {category.icon}
                    </div>
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.monthlyBudget != null
                          ? t('settings.budgetPerMonth', {
                              amount: formatMoney(category.monthlyBudget, currency),
                            })
                          : t('settings.noBudget')}
                        {' · '}
                        {category.type === 'income'
                          ? t('settings.income')
                          : t('settings.expense')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(category)}
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
              {editing ? t('settings.editCategory') : t('settings.addCategory')}
            </DialogTitle>
            <DialogDescription>{t('settings.categoriesDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t('settings.categoryName')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Groceries"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('settings.icon')}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🛒"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="size-8 rounded-full border-2 transition-transform hover:scale-110"
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
                <Label>{t('settings.monthlyBudget')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyBudget}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))}
                  placeholder="5000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {t('settings.saveCategory')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}
            </AlertDialogDescription>
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
