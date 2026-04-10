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
import { CopilotKit, useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
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

interface GeneratedFocusCard {
  generatedAt: string
  headline: string
  narrative: string
  routeScope: string
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

interface CopilotFocusBridgeProps {
  pathname: string
  sessionContext: CopilotSessionContextEvent | null
  shellState: AuthenticatedShellState
}

/**
 * 在 CopilotKit 运行时内注册只读前端动作，让助手可以安全地产生 dashboard 焦点卡片。
 */
function CopilotFocusBridge({
  pathname,
  sessionContext,
  shellState,
}: CopilotFocusBridgeProps): ReactNode {
  const [generatedFocusCard, setGeneratedFocusCard] = useState<GeneratedFocusCard | null>(null)

  useCopilotReadable(
    {
      description:
        'Current dashboard surface state that the assistant may use when generating read-only focus cards.',
      value: {
        pathname,
        permissionRuleCount: shellState.permissionRuleCount,
        roleCodes: shellState.roleCodes,
        sessionContext: sessionContext
          ? {
              requestId: sessionContext.requestId,
              roleCodes: sessionContext.roleCodes,
            }
          : null,
        visibleNavigation: shellState.visibleNavigation.map((item) => ({
          description: item.description,
          href: item.href,
          label: item.label,
        })),
      },
    },
    [pathname, sessionContext, shellState],
  )

  useCopilotAction(
    {
      available: 'enabled',
      description:
        'Render a read-only dashboard focus card for the current route without mutating data.',
      handler: ({
        headline,
        narrative,
        routeScope,
      }: {
        headline: string
        narrative: string
        routeScope: string
      }) => {
        startTransition(() => {
          setGeneratedFocusCard({
            generatedAt: new Date().toISOString(),
            headline,
            narrative,
            routeScope,
          })
        })
      },
      name: 'preview_dashboard_focus',
      parameters: [
        {
          description: 'Short title for the generated focus card.',
          name: 'headline',
          required: true,
          type: 'string',
        },
        {
          description: 'One concise paragraph explaining the focus.',
          name: 'narrative',
          required: true,
          type: 'string',
        },
        {
          description: 'Route or surface name that this focus card applies to.',
          name: 'routeScope',
          required: true,
          type: 'string',
        },
      ] as const,
      render: ({ args, status }) => (
        <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/80 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            AI-triggered focus
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">{args.headline}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{args.narrative}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{args.routeScope}</Badge>
            <Badge variant="secondary">{status}</Badge>
          </div>
        </div>
      ),
    },
    [pathname],
  )

  if (!generatedFocusCard) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border/80 bg-card-strong/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          AI-triggered focus
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ask the assistant to call <code>preview_dashboard_focus</code> to pin a read-only focus
          card for the current route.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-card-strong/82 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            AI-triggered focus
          </p>
          <p className="text-sm font-medium text-foreground">{generatedFocusCard.headline}</p>
        </div>
        <Badge variant="accent">{generatedFocusCard.routeScope}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{generatedFocusCard.narrative}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        Generated at {generatedFocusCard.generatedAt}
      </p>
    </div>
  )
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
  const hasUsableBridge =
    Boolean(initialBridgeSummary?.defaultAgentId) &&
    initialBridgeSummary?.capability.status === 'enabled'
  const [streamStatus, setStreamStatus] = useState<CopilotStreamStatus>(
    initialBridgeSummary ? (hasUsableBridge ? 'connecting' : 'error') : 'idle',
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

    if (
      bridgeSummaryQuery.data.capability.status === 'degraded' ||
      !bridgeSummaryQuery.data.defaultAgentId
    ) {
      startTransition(() => {
        setStreamStatus('error')
      })

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
            {bridgeSummary ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {bridgeSummary.capability.reason}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              {formatRequestContext(sessionContext)}
            </p>
          </div>

          {bridgeSummary?.defaultAgentId && bridgeSummary.capability.status === 'enabled' ? (
            <CopilotKit
              agent={bridgeSummary.defaultAgentId}
              credentials="include"
              runtimeUrl={bridgeSummary.endpoint}
              {...(threadId ? { threadId } : {})}
            >
              <div className="grid gap-4">
                <CopilotFocusBridge
                  pathname={pathname}
                  sessionContext={sessionContext}
                  shellState={shellState}
                />
                <div className="rounded-[var(--radius-xl)] border border-border/80 bg-card-strong/88 p-3 shadow-[var(--shadow-soft)]">
                  <CopilotChat
                    className="min-h-[32rem]"
                    instructions={instructions}
                    suggestions={suggestions}
                  />
                </div>
              </div>
            </CopilotKit>
          ) : (
            <div className="grid gap-4 rounded-[var(--radius-xl)] border border-dashed border-border/80 bg-card-strong/72 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                {bridgeSummary
                  ? bridgeSummary.capability.reason
                  : 'The authenticated Copilot bridge could not be loaded. Retry after the runtime summary path is healthy again.'}
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
