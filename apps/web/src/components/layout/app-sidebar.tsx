'use client'

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@ai-native-os/ui'
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

function SidebarItem({ item, pathname }: { item: NavigationItem; pathname: string }): ReactNode {
  return (
    <li key={item.href}>
      <Link
        className={cn(
          'grid gap-1 rounded-[var(--radius-lg)] border px-3 py-3 transition-colors',
          isNavigationItemActive(item.href, pathname)
            ? 'border-primary/20 bg-primary/10 text-foreground shadow-[var(--shadow-soft)]'
            : 'border-transparent text-muted-foreground hover:border-border/80 hover:bg-card/90 hover:text-foreground',
        )}
        href={item.href as Route}
      >
        <span className="text-sm font-medium">{item.label}</span>
        <span className="text-xs leading-5">{item.description}</span>
      </Link>
    </li>
  )
}

export function AppSidebar({ groupedNavigation, shellState }: AppSidebarProps): ReactNode {
  const pathname = usePathname()

  return (
    <aside className="hidden h-screen border-r border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,251,0.94))] xl:flex xl:flex-col">
      <div className="border-b border-border/80 px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">AI Native OS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Control Plane
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          AI lifecycle, governance, runtime inspection, and human review in one shell.
        </p>
      </div>

      <div className="border-b border-border/80 px-5 py-5">
        <div className="grid gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Current Operator
          </p>
          <p className="text-base font-semibold text-foreground">{shellState.session.user.name}</p>
          <p className="text-sm text-muted-foreground">{shellState.session.user.email}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {shellState.roleCodes.map((roleCode) => (
            <Badge key={roleCode} variant="secondary">
              {roleCode}
            </Badge>
          ))}
        </div>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-4 py-5">
        <div className="grid gap-6">
          {groupedNavigation.map((group) => (
            <section className="grid gap-2" key={group.key}>
              <div className="px-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
              </div>
              <ul className="grid gap-1.5">
                {group.items.map((item) => (
                  <SidebarItem item={item} key={item.href} pathname={pathname} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-border/80 px-4 py-4">
        <Card className="mb-3 border-border/80 bg-card/90 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Shell Summary
            </p>
            <CardTitle className="text-sm">Visibility & Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0 text-sm text-muted-foreground">
            <p>{shellState.permissionRuleCount} permission rules active.</p>
            <p>{shellState.hiddenNavigationCount} navigation surfaces hidden by RBAC.</p>
          </CardContent>
        </Card>
        <form action="/auth/sign-out" method="POST">
          <Button className="w-full" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  )
}
