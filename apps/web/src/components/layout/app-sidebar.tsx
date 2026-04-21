'use client'

import { Badge, Button, cn } from '@ai-native-os/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { NavigationItem } from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'
import type { NavigationGroup } from '@/lib/shell'
import { isNavigationItemActive } from '@/lib/shell'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from './sidebar'

interface AppSidebarProps {
  groupedNavigation: readonly NavigationGroup[]
  shellState: AuthenticatedShellState
}

function BrandMark(): ReactNode {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(226,232,240,0.92))] shadow-sm">
      <div className="h-5 w-5 rounded-xl bg-[linear-gradient(135deg,var(--foreground),rgba(59,130,246,0.82))]" />
    </div>
  )
}

function resolveNavigationGlyph(label: string): string {
  return label.slice(0, 1).toUpperCase()
}

function resolveUserInitial(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function SidebarItem({
  item,
  open,
  pathname,
}: {
  item: NavigationItem
  open: boolean
  pathname: string
}): ReactNode {
  const isActive = isNavigationItemActive(item.href, pathname)

  return (
    <li key={item.href}>
      <Link
        className={cn(
          'flex items-center rounded-xl border border-transparent text-sm font-medium transition-colors',
          open ? 'gap-3 px-2.5 py-2' : 'justify-center px-0 py-2.5',
          isActive
            ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground',
        )}
        href={item.href as Route}
        title={item.label}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] uppercase tracking-[0.12em]',
            isActive
              ? 'border-sidebar-border bg-sidebar text-sidebar-foreground'
              : 'border-sidebar-border bg-sidebar text-muted-foreground',
          )}
        >
          {resolveNavigationGlyph(item.label)}
        </span>
        {open ? <span className="truncate">{item.label}</span> : null}
      </Link>
    </li>
  )
}

export function AppSidebar({ groupedNavigation, shellState }: AppSidebarProps): ReactNode {
  const pathname = usePathname()
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
              <h1 className="mt-1 text-base font-semibold text-foreground">Control Plane</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI operations console</p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <nav aria-label="Primary navigation" className="grid gap-5">
          {groupedNavigation.map((group) => (
            <section className="grid gap-2" key={group.key}>
              {open ? (
                <div className="px-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </p>
                </div>
              ) : (
                <div className="mx-auto h-px w-8 bg-border/70" />
              )}
              <ul className="grid gap-1">
                {group.items.map((item) => (
                  <SidebarItem item={item} key={item.href} open={open} pathname={pathname} />
                ))}
              </ul>
            </section>
          ))}
        </nav>
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
              <p className="text-sm font-medium text-foreground">{shellState.session.user.name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {shellState.session.user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {shellState.roleCodes.map((roleCode) => (
                  <Badge key={roleCode} variant="secondary">
                    {roleCode}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {shellState.permissionRuleCount} permission rules ·{' '}
                {shellState.hiddenNavigationCount} hidden surfaces
              </p>
            </>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
              {resolveUserInitial(shellState.session.user.name)}
            </span>
          )}
        </div>
        <form action="/auth/sign-out" method="POST">
          <Button className="mt-3 w-full" type="submit" variant="secondary">
            {open ? 'Sign out' : 'Out'}
          </Button>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
