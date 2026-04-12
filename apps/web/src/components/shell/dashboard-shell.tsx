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
import { type ReactNode, useState } from 'react'

import { CopilotPanel } from '@/components/copilot/copilot-panel'
import type { AuthenticatedShellState } from '@/lib/api'
import {
  groupNavigationItems,
  isNavigationItemActive,
  resolveActiveNavigationItem,
  resolveShellModuleLabel,
} from '@/lib/shell'

interface DashboardShellProps {
  children: ReactNode
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

/**
 * 为已登录后台提供统一控制台壳层。
 *
 * 设计目标：
 * - 左侧固定导航承载信息架构
 * - 顶部上下文栏承载当前任务与主体状态
 * - 主工作区优先给业务页面
 * - Copilot 作为可折叠工作台，而不是与主内容同权竞争首屏
 */
export function DashboardShell({
  children,
  initialBridgeSummary,
  shellState,
}: DashboardShellProps): ReactNode {
  const pathname = usePathname()
  const [assistantOpen, setAssistantOpen] = useState(true)
  const groupedNavigation = groupNavigationItems(shellState.visibleNavigation)
  const activeNavigationItem = resolveActiveNavigationItem(pathname, shellState.visibleNavigation)
  const assistantStatus =
    initialBridgeSummary?.capability.status === 'enabled'
      ? 'ready'
      : initialBridgeSummary?.capability.status === 'degraded'
        ? 'degraded'
        : 'offline'

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden h-screen border-r border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.88))] xl:flex xl:flex-col">
          <div className="border-b border-border/80 px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              AI Native OS
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Control Console
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              以权限、审计、评测和工作流为中心的后台控制台。
            </p>
          </div>

          <div className="border-b border-border/80 px-5 py-5">
            <div className="grid gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Current Operator
              </p>
              <p className="text-base font-semibold text-foreground">
                {shellState.session.user.name}
              </p>
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
                  <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="grid gap-1.5">
                    {group.items.map((item) => (
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
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </nav>

          <div className="border-t border-border/80 px-4 py-4">
            <div className="mb-3 rounded-[var(--radius-lg)] border border-border/80 bg-card/90 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Shell summary
              </p>
              <p className="mt-2 text-sm text-foreground">
                {shellState.permissionRuleCount} rules, {shellState.hiddenNavigationCount} hidden
                surfaces.
              </p>
            </div>
            <form action="/auth/sign-out" method="POST">
              <Button className="w-full" type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-[rgba(248,250,252,0.88)] backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="grid gap-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {resolveShellModuleLabel(pathname)}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {activeNavigationItem?.label ?? 'Operator Workspace'}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {activeNavigationItem?.description ??
                    'Use the authenticated control surface to operate system, monitoring, and AI governance modules.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{shellState.roleCodes.join(', ')}</Badge>
                <Badge variant={assistantStatus === 'ready' ? 'accent' : 'secondary'}>
                  assistant:{assistantStatus}
                </Badge>
                <Button
                  onClick={() => {
                    setAssistantOpen((currentState) => !currentState)
                  }}
                  type="button"
                  variant="secondary"
                >
                  {assistantOpen ? 'Hide assistant' : 'Show assistant'}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border-t border-border/70 px-4 py-3 xl:hidden">
              <div className="flex min-w-max gap-2">
                {shellState.visibleNavigation.map((item) => (
                  <Link
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm transition-colors',
                      isNavigationItemActive(item.href, pathname)
                        ? 'border-primary/20 bg-primary/10 text-foreground'
                        : 'border-border/80 bg-card/90 text-muted-foreground',
                    )}
                    href={item.href as Route}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </header>

          <div
            className={cn(
              'grid flex-1 gap-6 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_24rem]',
              !assistantOpen && 'xl:grid-cols-[minmax(0,1fr)_5.75rem]',
            )}
          >
            <section className="min-w-0">{children}</section>

            <aside
              className={cn(
                'xl:sticky xl:top-[5.5rem] xl:h-[calc(100vh-7rem)]',
                !assistantOpen && 'xl:w-[5.75rem]',
              )}
            >
              {assistantOpen ? (
                <CopilotPanel initialBridgeSummary={initialBridgeSummary} shellState={shellState} />
              ) : (
                <Card className="flex h-full flex-col justify-between border-border/80 bg-card/90 shadow-[var(--shadow-soft)]">
                  <CardHeader className="gap-3 border-b border-border/70">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Copilot
                    </p>
                    <CardTitle className="text-lg">Collapsed</CardTitle>
                    <CardDescription>
                      Keep the workspace focused and reopen the assistant on demand.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-4">
                    <Badge variant={assistantStatus === 'ready' ? 'accent' : 'secondary'}>
                      {assistantStatus}
                    </Badge>
                    <Button
                      onClick={() => {
                        setAssistantOpen(true)
                      }}
                      type="button"
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
