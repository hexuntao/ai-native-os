'use client'

import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import { cn } from '@ai-native-os/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ContextRail } from '@/components/layout/context-rail'
import { Header } from '@/components/layout/header'
import { PageContainer } from '@/components/layout/page-container'
import type { AuthenticatedShellState } from '@/lib/api'
import {
  groupNavigationItems,
  isNavigationItemActive,
  resolveActiveNavigationItem,
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
    <div className="min-h-screen bg-muted/30">
      <div className="grid min-h-screen xl:grid-cols-[16rem_minmax(0,1fr)]">
        <AppSidebar groupedNavigation={groupedNavigation} shellState={shellState} />

        <div className="flex min-h-screen flex-col">
          <Header
            activeNavigationItem={activeNavigationItem}
            assistantStatus={assistantStatus}
            assistantToggleLabel={assistantOpen ? 'Hide context rail' : 'Show context rail'}
            onAssistantToggle={() => {
              setAssistantOpen((currentState) => !currentState)
            }}
            shellState={shellState}
          />

          <div className="border-b border-border/80 bg-background px-4 py-3 xl:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {shellState.visibleNavigation.map((item) => (
                <Link
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
                    isNavigationItemActive(item.href, pathname)
                      ? 'border-primary/20 bg-primary/10 text-foreground'
                      : 'border-border/80 bg-background text-muted-foreground',
                  )}
                  href={item.href as Route}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'grid flex-1 gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_24rem]',
              !assistantOpen && 'xl:grid-cols-[minmax(0,1fr)_5.75rem]',
            )}
          >
            <PageContainer>{children}</PageContainer>

            <aside
              className={cn(
                'xl:sticky xl:top-[5.5rem] xl:h-[calc(100vh-7rem)]',
                !assistantOpen && 'xl:w-[5.75rem]',
              )}
            >
              <ContextRail
                activeNavigationItem={activeNavigationItem}
                assistantOpen={assistantOpen}
                initialBridgeSummary={initialBridgeSummary}
                shellState={shellState}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
