'use client'

import type { CopilotBridgeSummary, CopilotSessionContextEvent } from '@ai-native-os/shared'
import { CopilotKit, useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { type ReactNode, startTransition, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface AssistantPanelProps {
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

interface GeneratedFocusCard {
  generatedAt: string
  headline: string
  narrative: string
  routeScope: string
}

function resolveStatusVariant(
  status: CopilotStreamStatus,
): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (status === 'ready') {
    return 'default'
  }

  if (status === 'error') {
    return 'destructive'
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

function CopilotFocusBridge({
  pathname,
  sessionContext,
  shellState,
}: {
  pathname: string
  sessionContext: CopilotSessionContextEvent | null
  shellState: AuthenticatedShellState
}): ReactNode {
  const [generatedFocusCard, setGeneratedFocusCard] = useState<GeneratedFocusCard | null>(null)

  useCopilotReadable(
    {
      description:
        'Current starter-based dashboard context available to the assistant for generating read-only focus cards.',
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
        <div className="rounded-lg border bg-background/80 p-3">
          <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
            AI-triggered focus
          </p>
          <p className="mt-2 text-sm font-medium">{args.headline}</p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">{args.narrative}</p>
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
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
          AI-triggered focus
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Ask the assistant to call <code>preview_dashboard_focus</code> to pin a read-only focus
          card for the current route.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
            AI-triggered focus
          </p>
          <p className="text-sm font-medium">{generatedFocusCard.headline}</p>
        </div>
        <Badge variant="outline">{generatedFocusCard.routeScope}</Badge>
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{generatedFocusCard.narrative}</p>
      <p className="text-muted-foreground mt-3 text-xs tracking-[0.16em] uppercase">
        Generated at {generatedFocusCard.generatedAt}
      </p>
    </div>
  )
}

export function AssistantPanel({
  initialBridgeSummary,
  shellState,
}: AssistantPanelProps): ReactNode {
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
    eventSource.addEventListener('error', handleError)

    return () => {
      eventSource.removeEventListener('runtime.ready', handleRuntimeReady)
      eventSource.removeEventListener('session.context', handleSessionContext)
      eventSource.removeEventListener('error', handleError)
      eventSource.close()
    }
  }, [bridgeSummaryQuery.data])

  const bridgeSummary = bridgeSummaryQuery.data
  const threadId = bridgeSummary
    ? createCopilotThreadId(bridgeSummary.resourceId, pathname)
    : undefined
  const suggestions = buildCopilotSuggestions(shellState, pathname)
  const instructions = buildCopilotInstructions(shellState, pathname)

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
              Assistant panel
            </p>
            <CardTitle className="text-xl">Operator Assistant</CardTitle>
          </div>
          <Badge variant={resolveStatusVariant(streamStatus)}>
            {resolveStatusLabel(streamStatus)}
          </Badge>
        </div>
        <div className="text-muted-foreground text-sm leading-6">
          Authenticated AG-UI bridge bound to the current operator, route, and RBAC scope.
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{bridgeSummary?.defaultAgentId ?? 'bridge-unavailable'}</Badge>
          <Badge variant="secondary">{pathname}</Badge>
          <Badge variant="secondary">{shellState.roleCodes.join(', ')}</Badge>
        </div>

        <div className="rounded-lg border bg-background/80 p-3">
          <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">Runtime</p>
          <p className="mt-2 text-sm leading-6">
            {bridgeSummary
              ? `${bridgeSummary.agentIds.length} agents available over ${bridgeSummary.transport}.`
              : 'Copilot bridge summary is unavailable for this session.'}
          </p>
          {bridgeSummary ? (
            <p className="text-muted-foreground mt-2 text-sm">{bridgeSummary.capability.reason}</p>
          ) : null}
          <p className="text-muted-foreground mt-3 text-sm">
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
              <div className="rounded-lg border bg-background/90 p-3">
                <CopilotChat
                  className="min-h-[26rem]"
                  instructions={instructions}
                  suggestions={suggestions}
                />
              </div>
            </div>
          </CopilotKit>
        ) : (
          <div className="grid gap-4 rounded-lg border border-dashed p-4">
            <p className="text-muted-foreground text-sm leading-6">
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
  )
}
