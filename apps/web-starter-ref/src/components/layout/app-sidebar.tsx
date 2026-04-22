'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Icons } from '@/components/icons'
import { useShellContext } from '@/components/layout/shell-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { isNavigationItemActive } from '@/lib/shell'

export default function AppSidebar(): ReactNode {
  const pathname = usePathname()
  const { groupedNavigation, shellState } = useShellContext()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3 py-3">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <Icons.logo className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-[11px] tracking-[0.24em] uppercase">
              AI Native OS
            </p>
            <p className="truncate text-sm font-semibold">Control Plane</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        {groupedNavigation.map((group) => (
          <SidebarGroup key={group.key} className="py-0">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = Icons[item.icon] ?? Icons.logo
                const isActive = isNavigationItemActive(item.href, pathname)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{shellState.session.user.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {shellState.session.user.email}
                    </span>
                  </div>
                  <Icons.chevronsDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{shellState.session.user.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {shellState.roleCodes.join(' · ') || '已认证'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action="/auth/sign-out" className="w-full" method="POST">
                    <button className="flex w-full items-center gap-2" type="submit">
                      <Icons.logout className="size-4" />
                      <span>退出登录</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
