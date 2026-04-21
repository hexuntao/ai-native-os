'use client'

import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import { cn } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ContextRail } from '@/components/layout/context-rail'
import { Header } from '@/components/layout/header'
import { PageContainer } from '@/components/layout/page-container'
import { SidebarInset, SidebarProvider } from '@/components/layout/sidebar'
import type { AuthenticatedShellState } from '@/lib/api'
import { groupNavigationItems, resolveActiveNavigationItem } from '@/lib/shell'

interface DashboardShellProps {
  children: ReactNode
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

/**
 * 为已登录后台提供统一控制台壳层。
 *
 * 设计目标：
 * - 完整对齐 dashboard starter 的左侧 sidebar / 中间 inset / 右侧 info rail 结构
 * - 把 AI-native 信息架构放进模板式骨架，而不是继续使用自定义三栏 grid
 * - 保留现有 Copilot 上下文 rail，但把它降级成 info sidebar 角色
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
    <SidebarProvider defaultOpen>
      <AppSidebar groupedNavigation={groupedNavigation} shellState={shellState} />

      <SidebarInset>
        <Header
          activeNavigationItem={activeNavigationItem}
          assistantStatus={assistantStatus}
          assistantToggleLabel={assistantOpen ? 'Hide context rail' : 'Show context rail'}
          onAssistantToggle={() => {
            setAssistantOpen((currentState) => !currentState)
          }}
          shellState={shellState}
        />

        <div className="flex-1 overflow-hidden">
          <div className="grid h-full gap-6 p-4 sm:p-6">
            <PageContainer>{children}</PageContainer>
          </div>
        </div>
      </SidebarInset>

      <aside
        className={cn(
          'hidden border-l border-border/80 bg-background/88 p-4 backdrop-blur xl:flex xl:w-96 xl:flex-col',
          !assistantOpen && 'xl:w-24',
        )}
      >
        <div className="sticky top-20 h-[calc(100vh-6.5rem)]">
          <ContextRail
            activeNavigationItem={activeNavigationItem}
            assistantOpen={assistantOpen}
            initialBridgeSummary={initialBridgeSummary}
            shellState={shellState}
          />
        </div>
      </aside>
    </SidebarProvider>
  )
}
