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
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const primaryNav = [
  { title: 'Transactions', icon: Receipt, href: '/' },
  { title: 'Trips', icon: Plane, href: '/trips' },
  { title: 'Debts', icon: Users, href: '/debts' },
]

const moreNav = [
  { title: 'Accounts', icon: Landmark, href: '/accounts' },
  { title: 'Friends', icon: UserPlus2, href: '/friends', badge: 'friends' as const },
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'AI Insights', icon: Sparkles, href: '/insights' },
  { title: 'LINE Bot', icon: MessageCircle, href: '/line' },
  { title: 'Settings', icon: Settings, href: '/settings' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const { openQuickAdd } = useQuickAdd()
  const { pendingReceived } = useFriends()
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
              <span>{item.title}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={openQuickAdd}
          className="flex flex-1 flex-col items-center justify-center"
          aria-label="Add transaction"
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
              <span>{item.title}</span>
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
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
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
                  <span className="flex-1">{item.title}</span>
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
