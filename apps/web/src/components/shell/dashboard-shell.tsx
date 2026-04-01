'use client'

import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@ai-native-os/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { CopilotPanel } from '@/components/copilot/copilot-panel'
import type { AuthenticatedShellState } from '@/lib/api'
import { isNavigationItemActive } from '@/lib/shell'

interface DashboardShellProps {
  children: ReactNode
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

/**
 * 为所有已登录页面提供统一的 dashboard 外壳，并消费共享导航/按钮/卡片原语。
 */
export function DashboardShell({
  children,
  initialBridgeSummary,
  shellState,
}: DashboardShellProps): ReactNode {
  const pathname = usePathname()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operator</p>
            <CardTitle className="text-3xl">{shellState.session.user.name}</CardTitle>
            <CardDescription>{shellState.session.user.email}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Roles</p>
            <CardTitle className="text-3xl">{shellState.roleCodes.length}</CardTitle>
            <CardDescription>Mapped RBAC roles for the authenticated subject.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {shellState.roleCodes.map((roleCode) => (
              <Badge key={roleCode} variant="secondary">
                {roleCode}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Permission Rules
            </p>
            <CardTitle className="text-3xl">{shellState.permissionRuleCount}</CardTitle>
            <CardDescription>
              {shellState.hiddenNavigationCount} surfaces hidden by ability checks
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem] xl:items-start">
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Authenticated Dashboard
            </p>
            <CardTitle className="text-3xl">AI Native OS</CardTitle>
            <CardDescription>
              App Router shell with server-rendered permission filtering and client-side provider
              baseline.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-5">
            <nav aria-label="Primary navigation">
              <ul className="grid gap-2">
                {shellState.visibleNavigation.map((item) => (
                  <li key={item.href}>
                    <Link
                      className={cn(
                        'grid gap-1 rounded-[var(--radius-lg)] border px-4 py-3 transition-transform duration-150 hover:-translate-y-0.5',
                        isNavigationItemActive(item.href, pathname)
                          ? 'border-primary/20 bg-primary/10'
                          : 'border-transparent bg-transparent hover:border-border/70 hover:bg-card-strong/60',
                      )}
                      href={item.href as Route}
                    >
                      <span className="text-lg font-medium">{item.label}</span>
                      <span className="text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <form action="/auth/sign-out" method="POST">
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-[34rem]">
          <CardContent className="p-6">{children}</CardContent>
        </Card>

        <CopilotPanel initialBridgeSummary={initialBridgeSummary} shellState={shellState} />
      </section>
    </main>
  )
}
