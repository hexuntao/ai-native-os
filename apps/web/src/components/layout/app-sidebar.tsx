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

function SidebarItem({ item, pathname }: { item: NavigationItem; pathname: string }): ReactNode {
  const isActive = isNavigationItemActive(item.href, pathname)

  return (
    <li key={item.href}>
      <Link
        className={cn(
          'flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        href={item.href as Route}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full bg-border transition-colors',
            isActive && 'bg-current',
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  )
}

export function AppSidebar({ groupedNavigation, shellState }: AppSidebarProps): ReactNode {
  const pathname = usePathname()

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border/80 bg-background xl:flex">
      <div className="border-b border-border/80 px-4 py-4">
        <div className="flex items-start gap-3">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              AI Native OS
            </p>
            <h1 className="mt-1 text-base font-semibold text-foreground">Control Plane</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              AI lifecycle, governance, runtime inspection, and human review.
            </p>
          </div>
        </div>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="grid gap-5">
          {groupedNavigation.map((group) => (
            <section className="grid gap-2" key={group.key}>
              <div className="px-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
              </div>
              <ul className="grid gap-1">
                {group.items.map((item) => (
                  <SidebarItem item={item} key={item.href} pathname={pathname} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-border/80 px-4 py-4">
        <div className="rounded-2xl border border-border/80 bg-background/80 p-3 shadow-sm">
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
            {shellState.permissionRuleCount} permission rules · {shellState.hiddenNavigationCount}{' '}
            hidden surfaces
          </p>
        </div>
        <form action="/auth/sign-out" method="POST">
          <Button className="mt-3 w-full" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  )
}
