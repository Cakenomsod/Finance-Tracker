'use client';

import * as React from 'react';
import { PiggyBank, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { useMoneyPools } from '@/hooks/use-money-pools';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { MoneyPool } from '@/lib/firestore-types';
import { DEFAULT_CATEGORY_COLORS } from '@/lib/default-categories';
import { formatMoney } from '@/lib/aggregate-transactions';
import { toast } from 'sonner';

interface PoolFormState {
  name: string;
  icon: string;
  color: string;
  openingBalance: string;
  targetAmount: string;
}

const emptyForm = (): PoolFormState => ({
  name: '',
  icon: '🎯',
  color: DEFAULT_CATEGORY_COLORS[3],
  openingBalance: '0',
  targetAmount: '',
});

function poolToForm(pool: MoneyPool): PoolFormState {
  return {
    name: pool.name,
    icon: pool.icon,
    color: pool.color,
    openingBalance: String(pool.openingBalance ?? 0),
    targetAmount: pool.targetAmount != null ? String(pool.targetAmount) : '',
  };
}

export function MoneyPoolsSettings() {
  const { activePools, loading, addPool, editPool, archivePool } = useMoneyPools();
  const { moneyPoolsEnabled, saveMoneyFeatures, currency } = useUserSettings();
  const { t } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MoneyPool | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<MoneyPool | null>(null);
  const [form, setForm] = React.useState<PoolFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (pool: MoneyPool) => {
    setEditing(pool);
    setForm(poolToForm(pool));
    setDialogOpen(true);
  };

  const handleTogglePools = async (checked: boolean) => {
    setToggling(true);
    try {
      await saveMoneyFeatures({ moneyPoolsEnabled: checked });
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('accounts.poolNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        icon: form.icon.trim() || '🎯',
        color: form.color,
        openingBalance: Number(form.openingBalance) || 0,
        targetAmount: form.targetAmount ? Number(form.targetAmount) : undefined,
      };
      if (editing?.id) {
        await editPool(editing.id, {
          name: data.name,
          icon: data.icon,
          color: data.color,
          openingBalance: data.openingBalance,
          targetAmount: form.targetAmount ? Number(form.targetAmount) : null,
        });
        toast.success(t('accounts.poolUpdated'));
      } else {
        await addPool(data);
        toast.success(t('accounts.poolAdded'));
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await archivePool(deleteTarget.id);
      toast.success(t('accounts.poolArchived'));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
            <PiggyBank className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {t('accounts.moneyPools')}
          </CardTitle>
          <CardDescription>{t('accounts.moneyPoolsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="pools-enabled" className="text-sm font-medium leading-none cursor-pointer">
                {t('accounts.enablePools')}
              </Label>
              <p className="text-sm text-muted-foreground text-pretty max-w-prose">
                {t('accounts.enablePoolsDesc')}
              </p>
            </div>
            <Switch
              id="pools-enabled"
              checked={moneyPoolsEnabled}
              disabled={toggling}
              onCheckedChange={handleTogglePools}
              className="mt-0.5 shrink-0"
            />
          </div>

          {moneyPoolsEnabled && (
            <>
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-4 mr-1" aria-hidden />
                {t('accounts.addPool')}
              </Button>

              {loading ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : activePools.length === 0 ? (
                <p className="text-sm text-muted-foreground text-pretty">{t('accounts.noPools')}</p>
              ) : (
                <ul className="space-y-2">
                  {activePools.map((pool) => (
                    <li
                      key={pool.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors duration-200 motion-reduce:transition-none hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg"
                          style={{ backgroundColor: `${pool.color}20` }}
                          aria-hidden
                        >
                          {pool.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{pool.name}</p>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {t('accounts.opening')}: {formatMoney(pool.openingBalance, currency)}
                            {pool.targetAmount != null && (
                              <> · {t('accounts.target')}: {formatMoney(pool.targetAmount, currency)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t('accounts.editPool')}
                          onClick={() => openEdit(pool)}
                        >
                          <Edit2 className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label={t('accounts.archivePool')}
                          onClick={() => setDeleteTarget(pool)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('accounts.editPool') : t('accounts.addPool')}</DialogTitle>
            <DialogDescription>{t('accounts.poolFormDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pool-name">{t('accounts.poolName')}</Label>
              <Input
                id="pool-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('accounts.poolNamePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pool-icon">{t('settings.icon')}</Label>
                <Input
                  id="pool-icon"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pool-color">{t('settings.color')}</Label>
                <Input
                  id="pool-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-opening">{t('accounts.openingBalance')}</Label>
              <Input
                id="pool-opening"
                type="number"
                value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-target">{t('accounts.targetOptional')}</Label>
              <Input
                id="pool-target"
                type="number"
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                placeholder={t('settings.budgetOptional')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />}
              {t('settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('accounts.archivePool')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('accounts.poolArchiveConfirm', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />}
              {t('accounts.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
