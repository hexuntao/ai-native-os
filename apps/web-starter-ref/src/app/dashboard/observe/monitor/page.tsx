import type { ReactNode } from 'react'
import { MetricCard } from '@/components/control-plane/metric-card'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'
import { formatCount } from '@/lib/format'
import { loadOnlineUsersList, loadServerSummary } from '@/lib/server-management'

function createInfoContent(): InfobarContent {
  return {
    title: 'Runtime Monitor',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Keep API, jobs, worker, and authenticated session posture in the same operating surface so the operator can triage runtime pressure before diving into traces.',
      },
      {
        title: 'Operator boundary',
        description:
          'This surface is an observability hub. It explains health and session posture, but it does not replace deeper traces or approval evidence.',
      },
    ],
  }
}

function resolveHealthVariant(status: string): 'default' | 'destructive' | 'secondary' {
  if (status === 'ok') {
    return 'default'
  }

  return 'secondary'
}

export default async function ObserveMonitorPage(): Promise<ReactNode> {
  const [serverSummary, onlinePayload] = await Promise.all([
    loadServerSummary(),
    loadOnlineUsersList({ page: 1, pageSize: 5, search: undefined }),
  ])

  const distinctRoles = new Set(onlinePayload.data.flatMap((row) => row.roleCodes)).size
  const unmappedCount = onlinePayload.data.filter((row) => row.roleCodes.length === 0).length

  return (
    <PageContainer
      pageTitle="Runtime Monitor"
      pageDescription="Service health, AI capability posture, and current authenticated presence in one control-plane surface."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge={serverSummary.health.status}
            detail={`ai:${serverSummary.health.ai.status} · jobs:${serverSummary.health.jobs.status} · worker:${serverSummary.health.worker.status}`}
            label="Runtime status"
            value={serverSummary.health.status}
            variant={serverSummary.health.status === 'ok' ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="agents"
            detail={`${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} enabled agents`}
            label="AI runtime"
            value={formatCount(serverSummary.runtime.toolCount)}
          />
          <MetricCard
            badge="sessions"
            detail="Visible authenticated sessions in the current page slice."
            label="Active sessions"
            value={formatCount(onlinePayload.pagination.total)}
          />
          <MetricCard
            badge={unmappedCount === 0 ? 'mapped' : 'attention'}
            detail="Online users with no mapped RBAC role codes."
            label="Unmapped users"
            value={formatCount(unmappedCount)}
            variant={unmappedCount === 0 ? 'outline' : 'secondary'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Dependency overview</CardDescription>
              <CardTitle>Runtime health</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={resolveHealthVariant(serverSummary.health.database)}>
                  database:{serverSummary.health.database}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.redis)}>
                  redis:{serverSummary.health.redis}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.jobs.status)}>
                  jobs:{serverSummary.health.jobs.status}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.worker.status)}>
                  worker:{serverSummary.health.worker.status}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.ai.status)}>
                  ai:{serverSummary.health.ai.status}
                </Badge>
              </div>

              <div className="grid gap-3 text-sm leading-6">
                <div className="rounded-lg border p-4">
                  Agents: {serverSummary.runtime.enabledAgentCount} enabled /{' '}
                  {serverSummary.runtime.agentCount} registered
                </div>
                <div className="rounded-lg border p-4">
                  Tools: {serverSummary.runtime.toolCount} tool surfaces
                </div>
                <div className="rounded-lg border p-4">
                  Workflows: {serverSummary.runtime.workflowCount} workflow entries
                </div>
                <div className="rounded-lg border p-4">
                  Environment: {serverSummary.environment.nodeEnv} · port{' '}
                  {serverSummary.environment.port}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Presence overview</CardDescription>
              <CardTitle>Session and RBAC mapping</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Distinct roles
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{formatCount(distinctRoles)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Visible users
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCount(onlinePayload.pagination.total)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {onlinePayload.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm leading-7">
                    No active sessions are visible in this slice.
                  </p>
                ) : (
                  onlinePayload.data.map((row) => (
                    <div className="rounded-lg border p-4 text-sm leading-6" key={row.sessionId}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant={row.roleCodes.length > 0 ? 'outline' : 'secondary'}>
                          {row.roleCodes.length > 0 ? row.roleCodes.join(', ') : 'unmapped'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-2">{row.email}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
