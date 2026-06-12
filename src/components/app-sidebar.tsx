'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Users,
  Plane,
  BarChart3,
  Sparkles,
  MessageCircle,
  Settings,
  Search,
  Command,
  Plus,
  ChevronDown,
  Wallet,
  UserPlus2,
  Bell,
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
import { Badge } from '@/components/ui/badge'

const mainNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Transactions', icon: Receipt, href: '/transactions' },
  { title: 'Debts & Shared', icon: Users, href: '/debts' },
  { title: 'Trip Mode', icon: Plane, href: '/trips' },
  { title: 'Friends', icon: UserPlus2, href: '/friends' },
]

const insightsNavItems = [
  { title: 'Analytics', icon: BarChart3, href: '/analytics' },
  { title: 'AI Insights', icon: Sparkles, href: '/insights' },
]

const integrationNavItems = [
  { title: 'LINE Bot', icon: MessageCircle, href: '/line' },
  { title: 'Settings', icon: Settings, href: '/settings' },
]

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { pendingReceived } = useFriends()
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
                    <Wallet className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">Finance</span>
                    <span className="text-xs text-muted-foreground">System</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Overview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                      tooltip={item.title}
                    >
                      <Link href={item.href} className="relative flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                        {item.href === '/friends' && pendingCount > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1">
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

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Insights</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {insightsNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Integrations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {integrationNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Preferences</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void signOut(); }}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
          <SidebarTrigger />
          
          <div className="flex-1">
            <Button
              variant="outline"
              className={cn(
                "relative h-9 w-full max-w-sm justify-start rounded-lg bg-muted/50 text-sm text-muted-foreground hover:bg-muted"
              )}
            >
              <Search className="mr-2 size-4" />
              <span>Search transactions...</span>
              <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                <Command className="size-3" />K
              </kbd>
            </Button>
          </div>

          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Expense</span>
          </Button>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
