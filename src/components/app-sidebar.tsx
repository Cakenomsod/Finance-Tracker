'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Users,
  Plane,
  Sparkles,
  MessageCircle,
  Settings,
  Search,
  Command,
  Plus,
  ChevronDown,
  UserPlus2,
  Bell,
  Landmark,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { useAuth } from '@/hooks/use-auth'
import { useFriends } from '@/hooks/use-friends'
import { useQuickAdd } from '@/components/quick-add-context'
import { useLocale } from '@/components/locale-provider'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { AppLogo } from '@/components/app-logo'
import { Badge } from '@/components/ui/badge'
import type { LocalizedText, MessageKey } from '@/lib/i18n'

type NavItem = { titleKey: MessageKey; icon: typeof Receipt; href: string }

const navGroups: { label: LocalizedText; items: NavItem[] }[] = [
  {
    label: { th: 'เงินของฉัน', en: 'Money', zh: '我的钱' },
    items: [
      { titleKey: 'nav.transactions', icon: Receipt, href: '/' },
      { titleKey: 'nav.accounts', icon: Landmark, href: '/accounts' },
    ],
  },
  {
    label: { th: 'หารกับคนอื่น', en: 'Shared', zh: '分摊' },
    items: [
      { titleKey: 'nav.debts', icon: Users, href: '/debts' },
      { titleKey: 'nav.trips', icon: Plane, href: '/trips' },
      { titleKey: 'nav.friends', icon: UserPlus2, href: '/friends' },
    ],
  },
  {
    label: { th: 'สรุป', en: 'Insights', zh: '分析' },
    items: [
      { titleKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { titleKey: 'nav.insights', icon: Sparkles, href: '/insights' },
    ],
  },
  {
    label: { th: 'ตั้งค่า', en: 'Settings', zh: '设置' },
    items: [
      { titleKey: 'nav.line', icon: MessageCircle, href: '/line' },
      { titleKey: 'nav.settings', icon: Settings, href: '/settings' },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { pendingReceived } = useFriends()
  const { openQuickAdd, openSearch } = useQuickAdd()
  const { t, p } = useLocale()
  const pendingCount = pendingReceived.length

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <AppLogo />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">Finance Tracker</span>
                    <span className="text-xs text-muted-foreground">
                      {p({ th: 'รายรับรายจ่าย & หารเงิน', en: 'Spending & splits', zh: '记账与分摊' })}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group, index) => (
            <React.Fragment key={group.label.en}>
              {index > 0 && <SidebarSeparator />}
              <SidebarGroup>
                <SidebarGroupLabel>{p(group.label)}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActivePath(pathname, item.href)}
                          tooltip={t(item.titleKey)}
                        >
                          <Link href={item.href} className="relative flex items-center gap-2">
                            <item.icon className="size-4" aria-hidden />
                            <span>{t(item.titleKey)}</span>
                            {item.href === '/friends' && pendingCount > 0 && (
                              <Badge
                                className="ml-auto h-5 min-w-5 rounded-full bg-destructive px-1 text-xs text-destructive-foreground"
                                aria-label={p({
                                  th: `คำขอเป็นเพื่อน ${pendingCount} รายการ`,
                                  en: `${pendingCount} friend requests`,
                                  zh: `${pendingCount} 个好友请求`,
                                })}
                              >
                                {pendingCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="rounded-full" />
                      ) : (
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {user?.displayName?.[0] || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-medium truncate max-w-[120px]">
                        {user?.displayName || 'User'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {user?.email || 'user@example.com'}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-dropdown-menu-trigger-width]"
                >
                  <DropdownMenuItem asChild>
                    <Link href="/settings?tab=account">
                      {p({ th: 'โปรไฟล์', en: 'Profile', zh: '个人资料' })}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings?tab=preferences">
                      {p({ th: 'การแสดงผลและภาษา', en: 'Display & language', zh: '显示与语言' })}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void signOut(); }}>
                    {p({ th: 'ออกจากระบบ', en: 'Sign out', zh: '退出登录' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-40 flex h-14 min-w-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-sm sm:gap-4 sm:px-4">
          <SidebarTrigger />
          
          <div className="flex-1">
            <Button
              variant="outline"
              onClick={openSearch}
              className={cn(
                "relative h-9 w-full max-w-sm justify-start rounded-lg bg-muted/50 text-sm text-muted-foreground hover:bg-muted"
              )}
            >
              <Search className="mr-2 size-4" aria-hidden />
              <span className="truncate">
                {p({ th: 'ค้นหารายการ...', en: 'Search entries...', zh: '搜索记录...' })}
              </span>
              <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium sm:flex">
                <Command className="size-3" aria-hidden />K
              </kbd>
            </Button>
          </div>

          <Button size="sm" className="hidden h-9 gap-2 md:inline-flex" onClick={() => openQuickAdd()}>
            <Plus className="size-4" aria-hidden />
            {p({ th: 'จดรายการ', en: 'Add entry', zh: '添加记录' })}
          </Button>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
