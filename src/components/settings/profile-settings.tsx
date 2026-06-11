'use client';

import * as React from 'react';
import { User } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
      await setLocale(value as 'en' | 'th');
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save language');
    }
  };

  if (loading && !profile) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          {t('settings.profile')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {photoURL && <AvatarImage src={photoURL} alt={name} />}
            <AvatarFallback className="bg-primary/20 text-primary text-xl">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{name}</h3>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">{t('settings.editProfile')}</Button>
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
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('settings.email')}</Label>
                  <Input value={email} disabled />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  {t('settings.cancel')}
                </Button>
                <Button onClick={handleSaveProfile} disabled={saving || !displayName.trim()}>
                  {t('settings.save')}
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
              <SelectTrigger id="currency">
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
            <p className="text-xs text-muted-foreground">
              {formatMoney(1000, currency)}
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
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
