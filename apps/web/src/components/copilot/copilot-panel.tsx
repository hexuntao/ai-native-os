'use client'

import type { CopilotBridgeSummary, CopilotSessionContextEvent } from '@ai-native-os/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ai-native-os/ui'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { type ReactNode, startTransition, useEffect, useState } from 'react'

import type { AuthenticatedShellState } from '@/lib/api'
import {
  buildCopilotInstructions,
  buildCopilotSuggestions,
  type CopilotStreamStatus,
  copilotBrowserPaths,
  createCopilotThreadId,
  fetchCopilotBridgeSummaryFromBrowser,
  parseCopilotSessionContextEventData,
} from '@/lib/copilot'

interface CopilotPanelProps {
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

function resolveStatusBadgeVariant(
  status: CopilotStreamStatus,
): 'accent' | 'outline' | 'secondary' {
  if (status === 'ready') {
    return 'accent'
  }

  if (status === 'error') {
    return 'outline'
  }

  return 'secondary'
}

function resolveStatusLabel(status: CopilotStreamStatus): string {
  switch (status) {
    case 'connecting':
      return 'Bridge syncing'
    case 'error':
      return 'Bridge degraded'
    case 'ready':
      return 'Bridge ready'
    default:
      return 'Bridge idle'
  }
}

function formatRequestContext(sessionContext: CopilotSessionContextEvent | null): string {
  if (!sessionContext) {
    return 'Waiting for authenticated runtime bootstrap.'
  }

  return `Request ${sessionContext.requestId.slice(0, 8)} · ${sessionContext.roleCodes.join(', ')}`
}

/**
 * 在 dashboard 右侧渲染受认证保护的 Copilot 聊天面板。
 *
 * 设计边界：
 * - 仅在已登录 shell 中加载，不向公共入口暴露聊天入口
 * - 运行时发现走 Next.js 同源代理，避免浏览器直接跨域访问 API
 * - 助手上下文始终绑定当前主体与当前页面，不制造共享对话语义
 */
export function CopilotPanel({ initialBridgeSummary, shellState }: CopilotPanelProps): ReactNode {
  const pathname = usePathname()
  const [streamStatus, setStreamStatus] = useState<CopilotStreamStatus>(
    initialBridgeSummary ? 'connecting' : 'idle',
  )
  const [sessionContext, setSessionContext] = useState<CopilotSessionContextEvent | null>(null)
  const bridgeSummaryQuery = useQuery({
    initialData: initialBridgeSummary ?? undefined,
    queryFn: fetchCopilotBridgeSummaryFromBrowser,
    queryKey: ['copilot-bridge-summary'],
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!bridgeSummaryQuery.data) {
      return
    }

    setStreamStatus('connecting')

    const eventSource = new EventSource(copilotBrowserPaths.runtimeEvents)

    const handleRuntimeReady = (): void => {
      startTransition(() => {
        setStreamStatus('ready')
      })
    }

    const handleSessionContext = (event: Event): void => {
      const parsedPayload = parseCopilotSessionContextEventData(
        (event as MessageEvent<string>).data,
      )

      if (!parsedPayload) {
        return
      }

      startTransition(() => {
        setSessionContext(parsedPayload)
        setStreamStatus('ready')
      })
    }

    const handleError = (): void => {
      startTransition(() => {
        setStreamStatus((currentStatus) => (currentStatus === 'ready' ? currentStatus : 'error'))
      })
    }

    eventSource.addEventListener('runtime.ready', handleRuntimeReady)
    eventSource.addEventListener('session.context', handleSessionContext)
    eventSource.onerror = handleError

    return () => {
      eventSource.removeEventListener('runtime.ready', handleRuntimeReady)
      eventSource.removeEventListener('session.context', handleSessionContext)
      eventSource.close()
    }
  }, [bridgeSummaryQuery.data])

  const bridgeSummary = bridgeSummaryQuery.data
  const threadId = bridgeSummary
    ? createCopilotThreadId(bridgeSummary.resourceId, pathname)
    : undefined
  const suggestions = buildCopilotSuggestions(shellState)
  const instructions = buildCopilotInstructions(shellState, pathname)

  return (
    <aside className="xl:sticky xl:top-6">
      <Card className="overflow-hidden border-primary/12 bg-[linear-gradient(180deg,rgba(255,250,241,0.96),rgba(247,239,228,0.92))] shadow-[var(--shadow-panel)]">
        <CardHeader className="gap-4 border-b border-border/70 bg-[radial-gradient(circle_at_top,rgba(186,79,31,0.12),transparent_62%)]">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Copilot Sidebar
              </p>
              <CardTitle className="text-2xl">Operator Assistant</CardTitle>
            </div>
            <Badge variant={resolveStatusBadgeVariant(streamStatus)}>
              {resolveStatusLabel(streamStatus)}
            </Badge>
          </div>

          <CardDescription>
            Authenticated AG-UI bridge bound to the current operator, route, and RBAC scope.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{bridgeSummary?.defaultAgentId ?? 'bridge-unavailable'}</Badge>
            <Badge variant="secondary">{pathname}</Badge>
            <Badge variant="secondary">{shellState.roleCodes.join(', ')}</Badge>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border/70 bg-card-strong/80 p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Runtime</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {bridgeSummary
                ? `${bridgeSummary.agentIds.length} agents available over ${bridgeSummary.transport}.`
                : 'Copilot bridge summary is unavailable for this session.'}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {formatRequestContext(sessionContext)}
            </p>
          </div>

          {bridgeSummary ? (
            <CopilotKit
              agent={bridgeSummary.defaultAgentId}
              credentials="include"
              runtimeUrl={bridgeSummary.endpoint}
              {...(threadId ? { threadId } : {})}
            >
              <div className="rounded-[var(--radius-xl)] border border-border/80 bg-card-strong/88 p-3 shadow-[var(--shadow-soft)]">
                <CopilotChat
                  className="min-h-[32rem]"
                  instructions={instructions}
                  suggestions={suggestions}
                />
              </div>
            </CopilotKit>
          ) : (
            <div className="grid gap-4 rounded-[var(--radius-xl)] border border-dashed border-border/80 bg-card-strong/72 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                The authenticated Copilot bridge could not be loaded. Retry after the runtime
                summary path is healthy again.
              </p>
              <Button
                onClick={() => {
                  void bridgeSummaryQuery.refetch()
                }}
                type="button"
                variant="secondary"
              >
                Retry bridge discovery
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
