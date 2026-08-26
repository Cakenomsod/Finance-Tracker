'use client';

import * as React from 'react';
import { User } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useUserSettings } from '@/hooks/use-user-settings';
import { useLocale } from '@/components/locale-provider';
import { CURRENCIES } from '@/lib/locale';
import { auth } from '@/lib/firebase';
import { formatMoney } from '@/lib/aggregate-transactions';
import { toast } from 'sonner';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ProfileSkeleton() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
          <User className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <Skeleton className="h-6 w-24" />
        </CardTitle>
        <Skeleton className="h-4 w-48 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28 shrink-0" />
        </div>
        <Separator className="my-6" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileSettings() {
  const { user } = useAuth();
  const { profile, loading, currency, saveProfile, saveCurrency } = useUserSettings();
  const { locale, setLocale, t } = useLocale();
  const [editOpen, setEditOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const name = profile?.displayName || user?.displayName || 'User';
  const email = profile?.email || user?.email || '';
  const photoURL = profile?.photoURL || user?.photoURL;

  React.useEffect(() => {
    if (editOpen) {
      setDisplayName(name);
    }
  }, [editOpen, name]);

  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      }
      await saveProfile({ displayName: displayName.trim() });
      toast.success(t('settings.profileUpdated'));
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = async (value: string) => {
    try {
      await saveCurrency(value);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save currency');
    }
  };

  const handleLocaleChange = async (value: string) => {
    try {
      await setLocale(value as 'en' | 'th' | 'zh');
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save language');
    }
  };

  if (loading && !profile) {
    return <ProfileSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
          <User className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {t('settings.profile')}
        </CardTitle>
        <CardDescription>{t('settings.profileDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 shrink-0">
            {photoURL && <AvatarImage src={photoURL} alt={name} />}
            <AvatarFallback className="bg-muted text-foreground text-xl font-medium">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight truncate text-balance">{name}</h3>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                {t('settings.editProfile')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('settings.editProfile')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">{t('settings.displayName')}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('settings.displayName')}
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">{t('settings.email')}</Label>
                  <Input id="profile-email" value={email} disabled autoComplete="email" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  {t('settings.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving || !displayName.trim()}
                >
                  {saving ? t('settings.saving') : t('settings.save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Separator className="my-6" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="currency">{t('settings.currency')}</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency" aria-describedby="currency-preview">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="currency-preview" className="text-xs text-muted-foreground tabular-nums">
              {t('settings.currencyPreview', { amount: formatMoney(1000, currency) })}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="language">{t('settings.language')}</Label>
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('settings.language.en')}</SelectItem>
                <SelectItem value="th">{t('settings.language.th')}</SelectItem>
                <SelectItem value="zh">{t('settings.language.zh')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
