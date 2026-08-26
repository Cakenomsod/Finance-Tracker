'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Plane,
  Users,
  Plus,
  MoreHorizontal,
  Sparkles,
  MessageCircle,
  Settings,
  UserPlus2,
  Landmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuickAdd } from '@/components/quick-add-context'
import { useFriends } from '@/hooks/use-friends'
import { useLocale } from '@/components/locale-provider'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { MessageKey } from '@/lib/i18n'

const primaryNav: { titleKey: MessageKey; icon: typeof Receipt; href: string }[] = [
  { titleKey: 'nav.transactions', icon: Receipt, href: '/' },
  { titleKey: 'nav.trips', icon: Plane, href: '/trips' },
  { titleKey: 'nav.debts', icon: Users, href: '/debts' },
]

const moreNav: {
  titleKey: MessageKey
  icon: typeof Landmark
  href: string
  badge?: 'friends'
}[] = [
  { titleKey: 'nav.accounts', icon: Landmark, href: '/accounts' },
  { titleKey: 'nav.friends', icon: UserPlus2, href: '/friends', badge: 'friends' },
  { titleKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { titleKey: 'nav.insights', icon: Sparkles, href: '/insights' },
  { titleKey: 'nav.line', icon: MessageCircle, href: '/line' },
  { titleKey: 'nav.settings', icon: Settings, href: '/settings' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const { openQuickAdd } = useQuickAdd()
  const { pendingReceived } = useFriends()
  const { t } = useLocale()
  const pendingCount = pendingReceived.length
  const [moreOpen, setMoreOpen] = React.useState(false)

  const moreIsActive = moreNav.some((item) => isActive(pathname, item.href))

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-16 items-stretch">
        {primaryNav.slice(0, 2).map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('size-5', active && 'text-primary')} />
              <span>{t(item.titleKey)}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={openQuickAdd}
          className="flex flex-1 flex-col items-center justify-center"
          aria-label={t('nav.transactions')}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Plus className="size-5" />
          </span>
        </button>

        {primaryNav.slice(2).map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('size-5', active && 'text-primary')} />
              <span>{t(item.titleKey)}</span>
            </Link>
          )
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                moreIsActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <MoreHorizontal className={cn('size-5', moreIsActive && 'text-primary')} />
              <span>{t('nav.more')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>{t('nav.more')}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid gap-1">
              {moreNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-muted',
                    isActive(pathname, item.href) && 'bg-muted text-primary'
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="flex-1">{t(item.titleKey)}</span>
                  {item.badge === 'friends' && pendingCount > 0 && (
                    <Badge className="h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1">
                      {pendingCount}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
