'use client'

import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { CopilotPanel } from '@/components/copilot/copilot-panel'
import type { NavigationItem } from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'
import { resolveCopilotRoutePanel } from '@/lib/copilot'

interface ContextRailProps {
  activeNavigationItem: NavigationItem | null
  assistantOpen: boolean
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

export function ContextRail({
  activeNavigationItem,
  assistantOpen,
  initialBridgeSummary,
  shellState,
}: ContextRailProps): ReactNode {
  const pathname = usePathname()
  const routePanel = resolveCopilotRoutePanel(pathname)

  if (!assistantOpen) {
    const assistantStatus =
      initialBridgeSummary?.capability.status === 'enabled'
        ? 'ready'
        : initialBridgeSummary?.capability.status === 'degraded'
          ? 'degraded'
          : 'offline'

    return (
      <Card className="flex h-full flex-col justify-between border-border/80 bg-card/90 shadow-[var(--shadow-soft)]">
        <CardHeader className="gap-3 border-b border-border/70">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Context Rail
          </p>
          <CardTitle className="text-lg">Collapsed</CardTitle>
          <CardDescription>
            Reopen the operator rail to inspect current-object context and Copilot actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          <Badge variant={assistantStatus === 'ready' ? 'accent' : 'secondary'}>
            {assistantStatus}
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid h-full gap-4">
      <Card className="border-border/80 bg-card/92 shadow-[var(--shadow-soft)]">
        <CardHeader className="gap-2 border-b border-border/70">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Current Object
          </p>
          <CardTitle className="text-lg">
            {activeNavigationItem?.label ?? 'Operator Workspace'}
          </CardTitle>
          <CardDescription>
            {activeNavigationItem?.description ??
              'No route-scoped object is active. Use the main canvas to choose a work surface.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {shellState.roleCodes.map((roleCode) => (
              <Badge key={roleCode} variant="secondary">
                {roleCode}
              </Badge>
            ))}
          </div>
          {routePanel ? (
            <div className="grid gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-3">
              <p className="text-sm font-medium text-foreground">{routePanel.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">{routePanel.summary}</p>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Guardrail: {routePanel.guardrail}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CopilotPanel initialBridgeSummary={initialBridgeSummary} shellState={shellState} />
    </div>
  )
}
