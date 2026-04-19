import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount } from '@/lib/format'
import { loadServerSummary } from '@/lib/server-management'

interface ServerIncidentRow {
  detail: string
  label: string
  tone: 'critical' | 'neutral' | 'warning'
}

/**
 * 根据健康检查状态推导工作台信号卡片的视觉层级。
 */
function resolveHealthTone(status: string): 'neutral' | 'positive' | 'warning' {
  return status === 'ok' || status === 'enabled' ? 'positive' : 'warning'
}

/**
 * 将遥测连通状态汇总为易读的控制台摘要。
 */
function summarizeTelemetryStatus(openTelemetry: string, sentry: string): string {
  const connectedCount = [openTelemetry, sentry].filter((status) => status === 'ok').length

  return `${connectedCount}/2 connected`
}

/**
 * 汇总当前运行态里最值得优先排查的异常点，帮助页面按异常优先而不是字段优先展示。
 */
function createServerIncidentQueue(
  payload: Awaited<ReturnType<typeof loadServerSummary>>,
): ServerIncidentRow[] {
  const incidents: ServerIncidentRow[] = []

  if (payload.health.database !== 'ok') {
    incidents.push({
      detail: '数据库健康异常会直接影响后台读写与 AI 治理证据持久化。',
      label: 'Database degraded',
      tone: 'critical',
    })
  }

  if (payload.health.ai.status !== 'enabled') {
    incidents.push({
      detail: payload.health.ai.reason,
      label: 'AI capability degraded',
      tone: 'warning',
    })
  }

  if (payload.runtime.enabledAgentCount === 0) {
    incidents.push({
      detail: '当前运行时没有启用 agent，Copilot 与 AI 控制面只剩受限只读能力。',
      label: 'No enabled agents',
      tone: 'warning',
    })
  }

  if (payload.health.telemetry.openTelemetry !== 'ok' || payload.health.telemetry.sentry !== 'ok') {
    incidents.push({
      detail: '遥测不完整会降低故障定位速度，尤其影响发布后事故回放。',
      label: 'Telemetry partial',
      tone: 'neutral',
    })
  }

  return incidents.length > 0
    ? incidents
    : [
        {
          detail: '当前页没有发现需要立即升级排查的运行时异常。',
          label: 'No urgent incident',
          tone: 'neutral',
        },
      ]
}

export default async function MonitorServerPage(): Promise<ReactNode> {
  const payload = await loadServerSummary()
  const telemetrySummary = summarizeTelemetryStatus(
    payload.health.telemetry.openTelemetry,
    payload.health.telemetry.sentry,
  )
  const incidentQueue = createServerIncidentQueue(payload)
  const assistantHandoff = resolveCopilotPageHandoff('/monitor/server')

  return (
    <StatusWorkbenchPage
      assistantHandoff={undefined}
      context={[
        {
          label: 'Environment',
          value: payload.environment.nodeEnv,
        },
        {
          label: 'Port',
          value: String(payload.environment.port),
        },
      ]}
      description="运行时控制台优先展示系统健康、AI 能力与依赖状态，避免运维视角继续埋在说明文案和字段表里。"
      eyebrow="Monitor Module"
      signals={[
        {
          badge: payload.health.api,
          detail: `database:${payload.health.database} · redis:${payload.health.redis}`,
          label: 'Overall status',
          tone: resolveHealthTone(payload.health.status),
          value: payload.health.status,
        },
        {
          badge: payload.health.ai.status,
          detail: payload.health.ai.reason,
          label: 'AI capability',
          tone: resolveHealthTone(payload.health.ai.status),
          value: payload.health.ai.status,
        },
        {
          badge: payload.runtime.runtimeStage,
          detail: `${payload.runtime.enabledAgentCount}/${payload.runtime.agentCount} agents · ${payload.runtime.workflowCount} workflows`,
          label: 'Runtime registry',
          tone: payload.runtime.enabledAgentCount > 0 ? 'positive' : 'warning',
          value: `${formatCount(payload.runtime.toolCount)} tools`,
        },
        {
          badge: telemetrySummary,
          detail: `otel:${payload.health.telemetry.openTelemetry} · sentry:${payload.health.telemetry.sentry}`,
          label: 'Telemetry',
          tone: telemetrySummary === '2/2 connected' ? 'positive' : 'neutral',
          value: telemetrySummary,
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Health strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">{payload.health.api}</Badge>
              <Badge variant={payload.health.ai.status === 'enabled' ? 'accent' : 'secondary'}>
                ai:{payload.health.ai.status}
              </Badge>
              <Badge variant={payload.health.database === 'ok' ? 'accent' : 'secondary'}>
                database:{payload.health.database}
              </Badge>
              <Badge variant={payload.health.redis === 'ok' ? 'accent' : 'secondary'}>
                redis:{payload.health.redis}
              </Badge>
              <Badge
                variant={payload.health.telemetry.openTelemetry === 'ok' ? 'accent' : 'secondary'}
              >
                otel:{payload.health.telemetry.openTelemetry}
              </Badge>
              <Badge variant={payload.health.telemetry.sentry === 'ok' ? 'accent' : 'secondary'}>
                sentry:{payload.health.telemetry.sentry}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Runtime boundary</p>
            <p className="text-sm leading-6 text-muted-foreground">
              当前页面只覆盖 API 运行态、Mastra 注册表与基础遥测，不直接声称 worker 或 queue
              的真实生产可用性。
            </p>
          </div>
        </div>
      }
      title="System Health"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Dependency status
              </p>
              <CardTitle className="text-xl">Core runtime dependencies</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <ResponsiveTableRegion
                hint="表格在窄屏下仍支持聚焦滚动，适合查看依赖状态这样的两列表格。"
                label="Server dependency status table"
                minWidthClassName="min-w-[28rem]"
              >
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">API status</TableCell>
                      <TableCell>{payload.health.api}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Database status</TableCell>
                      <TableCell>{payload.health.database}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Redis status</TableCell>
                      <TableCell>{payload.health.redis}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">OpenTelemetry status</TableCell>
                      <TableCell>{payload.health.telemetry.openTelemetry}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Sentry status</TableCell>
                      <TableCell>{payload.health.telemetry.sentry}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ResponsiveTableRegion>
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Runtime inventory
              </p>
              <CardTitle className="text-xl">Mastra registry footprint</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <ResponsiveTableRegion
                hint="运行时库存表格也支持键盘可达滚动，便于在窄屏下读取长字段。"
                label="Mastra runtime inventory table"
                minWidthClassName="min-w-[28rem]"
              >
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Runtime stage</TableCell>
                      <TableCell>{payload.runtime.runtimeStage}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Agent count</TableCell>
                      <TableCell>
                        {payload.runtime.enabledAgentCount}/{payload.runtime.agentCount}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Tool count</TableCell>
                      <TableCell>{payload.runtime.toolCount}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Workflow count</TableCell>
                      <TableCell>{payload.runtime.workflowCount}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">AI degrade reason</TableCell>
                      <TableCell>{payload.health.ai.reason}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ResponsiveTableRegion>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {assistantHandoff ? (
            <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Copilot handoff
                </p>
                <CardTitle className="text-xl">{assistantHandoff.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                <p>{assistantHandoff.summary}</p>
                {assistantHandoff.prompts.map((prompt) => (
                  <div
                    className="rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-3"
                    key={prompt}
                  >
                    {prompt}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Incident queue
              </p>
              <CardTitle className="text-xl">What deserves attention first</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              {incidentQueue.map((incident) => (
                <div
                  className="grid gap-1 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-3"
                  key={incident.label}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{incident.label}</span>
                    <Badge
                      variant={
                        incident.tone === 'critical'
                          ? 'outline'
                          : incident.tone === 'warning'
                            ? 'secondary'
                            : 'accent'
                      }
                    >
                      {incident.tone}
                    </Badge>
                  </div>
                  <p>{incident.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operator read
              </p>
              <CardTitle className="text-xl">What to trust here</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <p>数据库、Redis、AI 能力和遥测状态会影响本页的四张信号卡读数。</p>
              <p>
                如果 AI capability 退化，但 overall 仍然是 ok，意味着控制面还活着，但 AI
                链路不完整。
              </p>
              <p>
                如果 runtime registry 没有启用
                agent，本页会保留黄色提示，不会把空运行时伪装成正常态。
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Deployment context
              </p>
              <CardTitle className="text-xl">Current exposure</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Node environment</span>
                <span className="font-medium text-foreground">{payload.environment.nodeEnv}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Public port</span>
                <span className="font-medium text-foreground">{payload.environment.port}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </StatusWorkbenchPage>
  )
}
