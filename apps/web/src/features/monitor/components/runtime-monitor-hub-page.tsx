import type { OnlineUserListResponse, ServerSummary } from '@ai-native-os/shared'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { formatCount } from '@/lib/format'

interface RuntimeMonitorHubPageProps {
  onlinePayload: OnlineUserListResponse
  serverSummary: ServerSummary
}

export function RuntimeMonitorHubPage({
  onlinePayload,
  serverSummary,
}: RuntimeMonitorHubPageProps): ReactNode {
  return (
    <StatusWorkbenchPage
      context={[
        {
          label: 'Environment',
          value: serverSummary.environment.nodeEnv,
        },
        {
          label: 'Presence source',
          value: 'Better Auth sessions',
        },
      ]}
      description="Runtime Monitor 把服务健康与在线会话放到同一观察面，帮助操作员先决定是看依赖、看 AI 能力，还是看身份在线态。"
      eyebrow="Observe"
      signals={[
        {
          badge: serverSummary.health.status,
          detail: `ai:${serverSummary.health.ai.status} · jobs:${serverSummary.health.jobs.status} · worker:${serverSummary.health.worker.status}`,
          label: 'Runtime status',
          tone: serverSummary.health.status === 'ok' ? 'positive' : 'warning',
          value: serverSummary.health.status,
        },
        {
          badge: 'agents',
          detail: `${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} enabled`,
          label: 'AI runtime',
          tone: serverSummary.runtime.enabledAgentCount > 0 ? 'positive' : 'warning',
          value: formatCount(serverSummary.runtime.toolCount),
        },
        {
          badge: 'sessions',
          detail: '当前会话切片中的在线主体数量。',
          label: 'Active sessions',
          tone: onlinePayload.pagination.total > 0 ? 'positive' : 'neutral',
          value: formatCount(onlinePayload.pagination.total),
        },
        {
          badge: 'unmapped',
          detail: '缺少 RBAC 角色映射的在线会话数量。',
          label: 'Unmapped',
          tone: onlinePayload.data.some((row) => row.roleCodes.length === 0)
            ? 'warning'
            : 'neutral',
          value: formatCount(onlinePayload.data.filter((row) => row.roleCodes.length === 0).length),
        },
      ]}
      title="Runtime Monitor"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Runtime health
            </p>
            <CardTitle className="text-xl">Dependency overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={serverSummary.health.database === 'ok' ? 'accent' : 'secondary'}>
                database:{serverSummary.health.database}
              </Badge>
              <Badge variant={serverSummary.health.redis === 'ok' ? 'accent' : 'secondary'}>
                redis:{serverSummary.health.redis}
              </Badge>
              <Badge variant={serverSummary.health.jobs.status === 'ok' ? 'accent' : 'secondary'}>
                jobs:{serverSummary.health.jobs.status}
              </Badge>
              <Badge variant={serverSummary.health.worker.status === 'ok' ? 'accent' : 'secondary'}>
                worker:{serverSummary.health.worker.status}
              </Badge>
            </div>
            <a
              className="text-sm text-foreground underline-offset-4 hover:underline"
              href="/monitor/server"
            >
              Open detailed server health
            </a>
          </CardContent>
        </Card>

        <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Presence overview
            </p>
            <CardTitle className="text-xl">Session and RBAC mapping</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Visible sessions: {formatCount(onlinePayload.pagination.total)}
            </p>
            <p className="text-sm text-muted-foreground">
              Distinct roles in current slice:{' '}
              {formatCount(new Set(onlinePayload.data.flatMap((row) => row.roleCodes)).size)}
            </p>
            <a
              className="text-sm text-foreground underline-offset-4 hover:underline"
              href="/monitor/online"
            >
              Open detailed live sessions
            </a>
          </CardContent>
        </Card>
      </div>
    </StatusWorkbenchPage>
  )
}
