import type {
  AiAuditListResponse,
  AiEvalListResponse,
  AiGovernanceOverview,
  ServerSummary,
} from '@ai-native-os/shared'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { AssistantHandoffCard } from '@/components/management/page-feedback'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'

interface AiOperationsCenterPageProps {
  auditPayload: AiAuditListResponse
  evalPayload: AiEvalListResponse
  governanceOverview: AiGovernanceOverview
  serverSummary: ServerSummary
}

export function AiOperationsCenterPage({
  auditPayload,
  evalPayload,
  governanceOverview,
  serverSummary,
}: AiOperationsCenterPageProps): ReactNode {
  const degradedRuns = auditPayload.data.filter(
    (row) => row.status === 'error' || row.status === 'forbidden',
  ).length
  const failedEvalSuites = evalPayload.data.filter((row) => row.lastRunStatus === 'failed').length
  const assistantHandoff = resolveCopilotPageHandoff('/home')

  return (
    <StatusWorkbenchPage
      assistantHandoff={
        assistantHandoff ? (
          <AssistantHandoffCard
            badge={assistantHandoff.badge}
            description={assistantHandoff.summary}
            note={assistantHandoff.note}
            prompts={assistantHandoff.prompts}
            title={assistantHandoff.title}
          />
        ) : undefined
      }
      context={[
        {
          label: 'Environment',
          value: serverSummary.environment.nodeEnv,
        },
        {
          label: 'Runtime stage',
          value: serverSummary.runtime.runtimeStage,
        },
      ]}
      description="AI Operations Center 把 runtime、治理、评测和最近证据压缩成一张全局操作台，帮助操作员先判断优先级，再进入具体工作台。"
      eyebrow="Home"
      signals={[
        {
          badge: 'agents',
          detail: `${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} enabled`,
          label: 'Active agents',
          tone: serverSummary.runtime.enabledAgentCount > 0 ? 'positive' : 'warning',
          value: formatCount(serverSummary.runtime.enabledAgentCount),
        },
        {
          badge: degradedRuns === 0 ? 'clear' : 'attention',
          detail: '最近审计切片中的错误或拒绝事件数量。',
          label: 'Degraded runs',
          tone: degradedRuns === 0 ? 'positive' : 'warning',
          value: formatCount(degradedRuns),
        },
        {
          badge: failedEvalSuites === 0 ? 'stable' : 'regression',
          detail: '当前可见评测套件中最近一次执行失败的数量。',
          label: 'Eval regressions',
          tone: failedEvalSuites === 0 ? 'positive' : 'warning',
          value: formatCount(failedEvalSuites),
        },
        {
          badge: 'review queue',
          detail: '当前治理切片中待人工复核的 Prompt 治理项数量。',
          label: 'Pending approvals',
          tone: governanceOverview.reviewQueue.length > 0 ? 'warning' : 'neutral',
          value: formatCount(governanceOverview.reviewQueue.length),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Ops strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={serverSummary.health.status === 'ok' ? 'accent' : 'secondary'}>
                runtime:{serverSummary.health.status}
              </Badge>
              <Badge
                variant={serverSummary.health.ai.status === 'enabled' ? 'accent' : 'secondary'}
              >
                ai:{serverSummary.health.ai.status}
              </Badge>
              <Badge variant={failedEvalSuites === 0 ? 'accent' : 'secondary'}>
                eval-failures:{failedEvalSuites}
              </Badge>
              <Badge variant={governanceOverview.reviewQueue.length > 0 ? 'accent' : 'secondary'}>
                approvals:{governanceOverview.reviewQueue.length}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Operator boundary</p>
            <p className="text-sm leading-6 text-muted-foreground">
              主页只负责压缩优先级和风险，不替代具体的运行审查、评测诊断或审批证据工作台。
            </p>
          </div>
        </div>
      }
      title="AI Operations Center"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Live system map
              </p>
              <CardTitle className="text-xl">Runtime dependency posture</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 text-sm leading-6 text-muted-foreground">
              <p>
                Agents: {serverSummary.runtime.enabledAgentCount} enabled /{' '}
                {serverSummary.runtime.agentCount} registered
              </p>
              <p>Tools: {serverSummary.runtime.toolCount} registered tool surfaces.</p>
              <p>Workflows: {serverSummary.runtime.workflowCount} active workflow entries.</p>
              <p>
                AI capability: {serverSummary.health.ai.status} · {serverSummary.health.ai.reason}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-2 border-b border-border/70">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Attention queue
                </p>
                <CardTitle className="text-xl">Highest-pressure surfaces</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5">
                {governanceOverview.reviewQueue.slice(0, 4).map((entry) => (
                  <div
                    className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4"
                    key={entry.promptKey}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="accent">{entry.reviewAction}</Badge>
                      <Badge variant="secondary">v{entry.latestVersion.version}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{entry.promptKey}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {entry.reviewReason}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-2 border-b border-border/70">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Release pipeline
                </p>
                <CardTitle className="text-xl">Current release posture</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 text-sm leading-6 text-muted-foreground">
                <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                  Prompt draft → Eval → Approval → Release
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                  Release-ready prompt versions:{' '}
                  {formatCount(governanceOverview.summary.releaseReadyPromptVersions)}
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                  Total eval experiments:{' '}
                  {formatCount(governanceOverview.summary.totalEvalExperiments)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Recent high-impact events
            </p>
            <CardTitle className="text-xl">Latest evidence</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5">
            {auditPayload.data.slice(0, 5).map((row) => (
              <div
                className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4"
                key={row.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.status === 'success' ? 'secondary' : 'accent'}>
                    {row.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {row.action}:{row.subject}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{row.toolId}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </StatusWorkbenchPage>
  )
}
