'use client'

import { Badge, Button, cn } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarLinkButton,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { navGroups, type StarterRefNavItem } from '@/config/nav-config'
import { isItemActive } from '@/lib/navigation'

function BrandMark(): ReactNode {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sidebar-border bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(226,232,240,0.92))] shadow-sm">
      <div className="h-5 w-5 rounded-xl bg-[linear-gradient(135deg,var(--sidebar-primary),rgba(15,23,42,0.92))]" />
    </div>
  )
}

function resolveGlyph(title: string): string {
  return title.slice(0, 1).toUpperCase()
}

function NavEntry({ item }: { item: StarterRefNavItem }): ReactNode {
  const pathname = usePathname()
  const { open } = useSidebar()
  const isActive = isItemActive(item.url, pathname)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
        <SidebarLinkButton href={item.url}>
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] uppercase tracking-[0.12em]',
              isActive
                ? 'border-sidebar-border bg-sidebar text-sidebar-foreground'
                : 'border-sidebar-border bg-sidebar text-muted-foreground',
            )}
          >
            {resolveGlyph(item.title)}
          </span>
          {open ? <span className="truncate">{item.title}</span> : null}
        </SidebarLinkButton>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export default function AppSidebar(): ReactNode {
  const { open } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className={cn('flex items-start gap-3', !open && 'justify-center')}>
          <BrandMark />
          {open ? (
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                AI Native OS
              </p>
              <h1 className="mt-1 text-base font-semibold text-foreground">Starter Ref</h1>
              <p className="mt-1 text-sm text-muted-foreground">Shell migration baseline</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavEntry item={item} key={item.url} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div
          className={cn(
            'rounded-2xl border border-sidebar-border bg-sidebar shadow-sm',
            open ? 'p-3' : 'flex items-center justify-center p-2',
          )}
        >
          {open ? (
            <>
              <p className="text-sm font-medium text-foreground">Starter Ref Operator</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                migration@ai-native-os.local
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">ref</Badge>
                <Badge variant="secondary">admin</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Shell only. No auth, RBAC, or runtime data bindings yet.
              </p>
            </>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
              R
            </span>
          )}
        </div>
        <Button className="mt-3 w-full" type="button" variant="secondary">
          {open ? 'Starter Ref' : 'Ref'}
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
