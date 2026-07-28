'use client';

import * as React from 'react';
import {
  Landmark,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Star,
  CreditCard,
  Banknote,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { usePaymentSources } from '@/hooks/use-payment-sources';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { PaymentSource, PaymentSourceType } from '@/lib/firestore-types';
import { BankSearchCombobox } from '@/components/accounts/bank-search-combobox';
import { getBankByCode } from '@/lib/thai-banks';
import { getSourceDisplaySubtitle } from '@/lib/account-balances';
import { DEFAULT_CATEGORY_COLORS } from '@/lib/default-categories';
import { createPaymentSource } from '@/lib/firestore';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SourceFormState {
  type: PaymentSourceType;
  name: string;
  bankCode: string;
  branchName: string;
  accountNumber: string;
  linkedSourceId: string;
  openingBalance: string;
  isDefault: boolean;
}

const emptyForm = (): SourceFormState => ({
  type: 'bank_account',
  name: '',
  bankCode: '',
  branchName: '',
  accountNumber: '',
  linkedSourceId: '',
  openingBalance: '0',
  isDefault: false,
});

function sourceToForm(source: PaymentSource): SourceFormState {
  return {
    type: source.type,
    name: source.name,
    bankCode: source.bankCode ?? '',
    branchName: source.branchName ?? '',
    accountNumber: source.accountNumber ?? '',
    linkedSourceId: source.linkedSourceId ?? '',
    openingBalance: String(source.openingBalance ?? 0),
    isDefault: source.isDefault ?? false,
  };
}

function SourceTypeIcon({ type }: { type: PaymentSourceType }) {
  if (type === 'cash') return <Banknote className="size-4" aria-hidden />;
  if (type === 'debit_card') return <CreditCard className="size-4" aria-hidden />;
  return <Landmark className="size-4" aria-hidden />;
}

export function PaymentSourcesSettings() {
  const { user } = useAuth();
  const {
    activeSources,
    bankAccounts,
    loading,
    addSource,
    editSource,
    archiveSource,
    setDefaultSource,
    reorderSources,
  } = usePaymentSources();
  const { accountsEnabled, saveMoneyFeatures } = useUserSettings();
  const { t, locale } = useLocale();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PaymentSource | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PaymentSource | null>(null);
  const [form, setForm] = React.useState<SourceFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const moveSource = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= activeSources.length || fromIndex === toIndex) return;
    const ids = activeSources.map((s) => s.id!).filter(Boolean);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    try {
      await reorderSources(ids);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const openCreate = (type: PaymentSourceType = 'bank_account') => {
    setEditing(null);
    setForm({ ...emptyForm(), type });
    setDialogOpen(true);
  };

  const openEdit = (source: PaymentSource) => {
    setEditing(source);
    setForm(sourceToForm(source));
    setDialogOpen(true);
  };

  const handleToggleAccounts = async (checked: boolean) => {
    setToggling(true);
    try {
      await saveMoneyFeatures({ accountsEnabled: checked });
      if (checked && user) {
        const hasCash = activeSources.some((s) => s.type === 'cash');
        if (!hasCash) {
          await createPaymentSource({
            userId: user.uid,
            type: 'cash',
            name: locale === 'th' ? 'เงินสด' : 'Cash',
            openingBalance: 0,
            sortOrder: 0,
            icon: '💵',
            color: DEFAULT_CATEGORY_COLORS[2],
          });
        }
      }
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('accounts.nameRequired'));
      return;
    }
    if (form.type !== 'cash' && !form.bankCode) {
      toast.error(t('accounts.bankRequired'));
      return;
    }
    if (form.type === 'debit_card' && !form.linkedSourceId) {
      toast.error(t('accounts.linkedAccountRequired'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        type: form.type,
        name: form.name.trim(),
        bankCode: form.type === 'cash' ? undefined : form.bankCode,
        branchName: form.branchName.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        linkedSourceId: form.type === 'debit_card' ? form.linkedSourceId : undefined,
        openingBalance: Number(form.openingBalance) || 0,
        isDefault: form.isDefault,
        color: getBankByCode(form.bankCode)?.color ?? DEFAULT_CATEGORY_COLORS[0],
        icon: form.type === 'cash' ? '💵' : form.type === 'debit_card' ? '💳' : '🏦',
      };
      if (editing?.id) {
        await editSource(editing.id, data);
        toast.success(t('accounts.sourceUpdated'));
      } else {
        await addSource(data);
        toast.success(t('accounts.sourceAdded'));
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
      await archiveSource(deleteTarget.id);
      toast.success(t('accounts.sourceArchived'));
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
            <Landmark className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {t('accounts.paymentSources')}
          </CardTitle>
          <CardDescription>{t('accounts.paymentSourcesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="accounts-enabled" className="text-sm font-medium leading-none cursor-pointer">
                {t('accounts.enableAccounts')}
              </Label>
              <p className="text-sm text-muted-foreground text-pretty max-w-prose">
                {t('accounts.enableAccountsDesc')}
              </p>
            </div>
            <Switch
              id="accounts-enabled"
              checked={accountsEnabled}
              disabled={toggling}
              onCheckedChange={handleToggleAccounts}
              className="mt-0.5 shrink-0"
            />
          </div>

          {accountsEnabled && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => openCreate('bank_account')}>
                  <Plus className="size-4 mr-1" aria-hidden />
                  {t('accounts.addBankAccount')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => openCreate('debit_card')}>
                  <Plus className="size-4 mr-1" aria-hidden />
                  {t('accounts.addDebitCard')}
                </Button>
              </div>

              {loading ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : activeSources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-pretty">{t('accounts.noSources')}</p>
              ) : (
                <ul className="space-y-2 list-none p-0 m-0" aria-label={t('accounts.reorderHint')}>
                  {activeSources.map((source, index) => {
                    const subtitle = getSourceDisplaySubtitle(source);
                    const bank = getBankByCode(source.bankCode);
                    const isDragging = dragIndex === index;
                    const isDropTarget =
                      overIndex === index && dragIndex !== null && dragIndex !== index;
                    return (
                      <li
                        key={source.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverIndex(index);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) void moveSource(dragIndex, index);
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg border p-3 transition-[opacity,background-color,border-color] duration-200 motion-reduce:transition-none',
                          'hover:bg-muted/40',
                          isDragging && 'opacity-50',
                          isDropTarget && 'border-primary bg-primary/5'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <button
                              type="button"
                              className={cn(
                                'flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground',
                                'hover:bg-muted hover:text-foreground active:cursor-grabbing',
                                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                              )}
                              aria-label={t('accounts.reorderAria', { name: source.name })}
                              aria-grabbed={isDragging}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="size-4" aria-hidden />
                            </button>
                            <div className="flex flex-col sm:hidden">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                disabled={index === 0}
                                aria-label={t('accounts.moveUp')}
                                onClick={() => void moveSource(index, index - 1)}
                              >
                                <ChevronUp className="size-3.5" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                disabled={index === activeSources.length - 1}
                                aria-label={t('accounts.moveDown')}
                                onClick={() => void moveSource(index, index + 1)}
                              >
                                <ChevronDown className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          </div>
                          <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${source.color ?? bank?.color ?? '#888'}20` }}
                          >
                            <SourceTypeIcon type={source.type} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate flex items-center gap-1.5">
                              {source.name}
                              {source.isDefault && (
                                <Star className="size-3.5 fill-primary text-primary shrink-0" aria-label={t('accounts.defaultSource')} />
                              )}
                            </p>
                            {subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <div className="hidden sm:flex flex-col">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={index === 0}
                              aria-label={t('accounts.moveUp')}
                              onClick={() => void moveSource(index, index - 1)}
                            >
                              <ChevronUp className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={index === activeSources.length - 1}
                              aria-label={t('accounts.moveDown')}
                              onClick={() => void moveSource(index, index + 1)}
                            >
                              <ChevronDown className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                          {!source.isDefault && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('accounts.setDefault')}
                              onClick={() => source.id && setDefaultSource(source.id)}
                            >
                              <Star className="size-4" aria-hidden />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('accounts.editSource')}
                            onClick={() => openEdit(source)}
                          >
                            <Edit2 className="size-4" aria-hidden />
                          </Button>
                          {source.type !== 'cash' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={t('accounts.archiveSource')}
                              onClick={() => setDeleteTarget(source)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('accounts.editSource') : t('accounts.addSource')}
            </DialogTitle>
            <DialogDescription>{t('accounts.sourceFormDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <Label>{t('settings.type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as PaymentSourceType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">{t('accounts.typeBank')}</SelectItem>
                    <SelectItem value="debit_card">{t('accounts.typeDebit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.type !== 'cash' && (
              <div className="space-y-2">
                <Label>{t('accounts.bank')}</Label>
                <BankSearchCombobox
                  value={form.bankCode}
                  onChange={(code) => setForm((f) => ({ ...f, bankCode: code }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="source-name">{t('accounts.sourceName')}</Label>
              <Input
                id="source-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('accounts.sourceNamePlaceholder')}
              />
            </div>
            {form.type === 'bank_account' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="branch">{t('accounts.branchOptional')}</Label>
                  <Input
                    id="branch"
                    value={form.branchName}
                    onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acct-num">{t('accounts.accountNumberOptional')}</Label>
                  <Input
                    id="acct-num"
                    value={form.accountNumber}
                    onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="xxx-x-xxxxx-x"
                  />
                </div>
              </>
            )}
            {form.type === 'debit_card' && (
              <div className="space-y-2">
                <Label>{t('accounts.linkedBankAccount')}</Label>
                <Select
                  value={form.linkedSourceId || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, linkedSourceId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('accounts.selectLinkedAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acct) => (
                      <SelectItem key={acct.id} value={acct.id!}>
                        {acct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="opening">{t('accounts.openingBalance')}</Label>
              <Input
                id="opening"
                type="number"
                inputMode="decimal"
                value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="default-source" className="cursor-pointer">{t('accounts.setAsDefault')}</Label>
              <Switch
                id="default-source"
                checked={form.isDefault}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isDefault: checked }))}
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
            <AlertDialogTitle>{t('accounts.archiveSource')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('accounts.archiveConfirm', { name: deleteTarget?.name ?? '' })}
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
