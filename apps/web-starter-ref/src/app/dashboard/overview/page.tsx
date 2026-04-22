import type {
  AiAuditListResponse,
  AiEvalListResponse,
  AiGovernanceOverview,
  ServerSummary,
} from '@ai-native-os/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'
import {
  loadAiAuditLogsList,
  loadAiEvalsList,
  loadAiGovernanceOverview,
  loadServerSummary,
} from '@/lib/server-ai-management'

interface AttentionQueueItem {
  badge: string
  detail: string
  href: string
  label: string
  priority: number
  title: string
}

interface PostureChip {
  detail: string
  label: string
  value: string
  variant: 'default' | 'destructive' | 'outline' | 'secondary'
}

interface PrimaryOperatorCall {
  badge: string
  ctaHref: string
  ctaLabel: string
  detail: string
  title: string
}

function createInfoContent(primaryCall: PrimaryOperatorCall): InfobarContent {
  return {
    title: 'AI Operations Center',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Use the operator summary to decide the first safe next step, then move into a single workbench with the highest-confidence evidence.',
        links: [
          {
            title: primaryCall.ctaLabel,
            url: primaryCall.ctaHref,
          },
          {
            title: 'Inspect runtime traces',
            url: '/dashboard/observe/runs',
          },
        ],
      },
      {
        title: 'Operator boundary',
        description:
          'This page compresses pressure across runtime, approvals, and evals, but detailed judgment still belongs in the dedicated workbenches.',
      },
    ],
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function createPostureChips(
  serverSummary: ServerSummary,
  governanceOverview: AiGovernanceOverview,
  evalPayload: AiEvalListResponse,
  _auditPayload: AiAuditListResponse,
): PostureChip[] {
  const failedEvalSuites = evalPayload.data.filter((row) => row.lastRunStatus === 'failed').length

  return [
    {
      detail: `${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} agents enabled across the runtime registry.`,
      label: 'Runtime',
      value: serverSummary.health.status === 'ok' ? 'stable' : 'degraded',
      variant: serverSummary.health.status === 'ok' ? 'outline' : 'secondary',
    },
    {
      detail:
        governanceOverview.reviewQueue.length === 0
          ? 'No visible approval pressure in the current governance slice.'
          : `${formatCount(governanceOverview.reviewQueue.length)} approval items need human review.`,
      label: 'Release',
      value: governanceOverview.reviewQueue.length === 0 ? 'clear' : 'review queue',
      variant: governanceOverview.reviewQueue.length === 0 ? 'outline' : 'secondary',
    },
    {
      detail:
        failedEvalSuites === 0
          ? 'Latest visible eval runs are stable.'
          : `${formatCount(failedEvalSuites)} visible eval suites failed their latest run.`,
      label: 'Eval',
      value: failedEvalSuites === 0 ? 'stable' : 'regression',
      variant: failedEvalSuites === 0 ? 'outline' : 'secondary',
    },
  ]
}

function createPrimaryOperatorCall(
  serverSummary: ServerSummary,
  governanceOverview: AiGovernanceOverview,
  evalPayload: AiEvalListResponse,
  auditPayload: AiAuditListResponse,
): PrimaryOperatorCall {
  const degradedEntry = auditPayload.data.find(
    (row) => row.status === 'error' || row.status === 'forbidden',
  )
  const failedEvalSuite = evalPayload.data.find((row) => row.lastRunStatus === 'failed')
  const reviewItem = governanceOverview.reviewQueue[0]

  if (degradedEntry) {
    return {
      badge: degradedEntry.status,
      ctaHref: `/dashboard/observe/runs?auditId=${degradedEntry.id}`,
      ctaLabel: 'Open the highest-risk trace',
      detail:
        degradedEntry.status === 'forbidden'
          ? 'A forbidden runtime event is visible in the current audit slice. Confirm whether it is a policy boundary or a missing capability before escalating.'
          : 'A failed runtime event is visible in the current audit slice. Verify execution evidence and human feedback before widening scope.',
      title: `${degradedEntry.action}:${degradedEntry.subject} is the first operator stop`,
    }
  }

  if (reviewItem) {
    return {
      badge: resolveReviewActionLabel(reviewItem.reviewAction),
      ctaHref: `/dashboard/govern/approvals?promptKey=${encodeURIComponent(reviewItem.promptKey)}`,
      ctaLabel: 'Review the first approval item',
      detail:
        'The release queue still needs human judgment. Start with the most visible approval item and confirm that policy, eval, and rollback evidence are aligned.',
      title: `${reviewItem.promptKey} is blocking release flow`,
    }
  }

  if (failedEvalSuite) {
    return {
      badge: 'eval regression',
      ctaHref: `/dashboard/improve/evals?search=${encodeURIComponent(failedEvalSuite.id)}`,
      ctaLabel: 'Inspect eval regressions',
      detail:
        'No urgent runtime or approval pressure is visible, but at least one eval suite failed. Confirm whether the regression blocks the next release step.',
      title: `${failedEvalSuite.name} needs eval follow-up`,
    }
  }

  return {
    badge: serverSummary.health.status === 'ok' ? 'stable' : 'watch',
    ctaHref: '/dashboard/observe/monitor',
    ctaLabel: 'Inspect runtime posture',
    detail:
      'The current slice looks operationally stable. Use runtime posture and recent evidence to confirm nothing is drifting out of tolerance.',
    title: 'No immediate operator fire is visible',
  }
}

function createAttentionQueue(
  governanceOverview: AiGovernanceOverview,
  evalPayload: AiEvalListResponse,
  auditPayload: AiAuditListResponse,
): AttentionQueueItem[] {
  const auditItems: AttentionQueueItem[] = auditPayload.data
    .filter((row) => row.status === 'error' || row.status === 'forbidden')
    .slice(0, 3)
    .map((row, index) => ({
      badge: row.status,
      detail: `${row.toolId} · ${formatDateTime(row.createdAt)}`,
      href: `/dashboard/observe/runs?auditId=${row.id}`,
      label: 'Runtime incident',
      priority: 120 - index,
      title: `${row.action}:${row.subject}`,
    }))

  const approvalItems: AttentionQueueItem[] = governanceOverview.reviewQueue
    .slice(0, 3)
    .map((entry, index) => ({
      badge: resolveReviewActionLabel(entry.reviewAction),
      detail: entry.reviewReason,
      href: `/dashboard/govern/approvals?promptKey=${encodeURIComponent(entry.promptKey)}`,
      label: 'Approval pressure',
      priority: 90 - index,
      title: entry.promptKey,
    }))

  const evalItems: AttentionQueueItem[] = evalPayload.data
    .filter((row) => row.lastRunStatus === 'failed')
    .slice(0, 2)
    .map((row, index) => ({
      badge: 'failed',
      detail: `${formatCount(row.scorerCount)} scorers · dataset ${row.datasetSize ?? 'unknown'} rows.`,
      href: `/dashboard/improve/evals?search=${encodeURIComponent(row.id)}`,
      label: 'Eval regression',
      priority: 70 - index,
      title: row.name,
    }))

  return [...auditItems, ...approvalItems, ...evalItems]
    .toSorted((left, right) => right.priority - left.priority)
    .slice(0, 5)
}

function resolveReviewActionLabel(action: string): string {
  switch (action) {
    case 'activate_ready_version':
      return 'activate'
    case 'attach_eval_evidence':
      return 'attach eval'
    case 'investigate_exception':
      return 'investigate'
    case 'review_override':
      return 'override'
    case 'review_release_gate':
      return 'release gate'
    default:
      return 'review'
  }
}

export default async function OverViewPage(): Promise<ReactNode> {
  const [serverSummary, governanceOverview, evalPayload, auditPayload] = await Promise.all([
    loadServerSummary(),
    loadAiGovernanceOverview({ page: 1, pageSize: 5, search: undefined }),
    loadAiEvalsList({ page: 1, pageSize: 5, search: undefined }),
    loadAiAuditLogsList({
      page: 1,
      pageSize: 5,
      search: undefined,
      status: 'all',
      toolId: undefined,
    }),
  ])

  const primaryCall = createPrimaryOperatorCall(
    serverSummary,
    governanceOverview,
    evalPayload,
    auditPayload,
  )
  const postureChips = createPostureChips(
    serverSummary,
    governanceOverview,
    evalPayload,
    auditPayload,
  )
  const attentionQueue = createAttentionQueue(governanceOverview, evalPayload, auditPayload)
  const recentEvidence = auditPayload.data.slice(0, 4)

  return (
    <PageContainer
      pageTitle="AI Operations Center"
      pageDescription="System-wide AI operating picture with runtime, governance, eval, and recent evidence signals."
      infoContent={createInfoContent(primaryCall)}
    >
      <div className="flex flex-1 flex-col space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Operator summary</Badge>
                <Badge variant="outline">{primaryCall.badge}</Badge>
              </div>
              <div className="grid gap-3">
                <CardDescription>Current global conclusion</CardDescription>
                <CardTitle className="text-3xl leading-tight xl:text-4xl">
                  {primaryCall.title}
                </CardTitle>
                <p className="text-muted-foreground max-w-3xl text-sm leading-7">
                  {primaryCall.detail}
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={primaryCall.ctaHref as Route}>{primaryCall.ctaLabel}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/observe/runs">Inspect runtime traces</Link>
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {postureChips.map((chip) => (
                  <div className="rounded-lg border bg-background/80 p-4" key={chip.label}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{chip.label}</p>
                      <Badge variant={chip.variant}>{chip.value}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-3 text-sm leading-6">{chip.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Operator posture</CardDescription>
              <CardTitle>What to inspect next</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  Runtime stage
                </span>
                <span className="mt-2 block font-medium">{serverSummary.runtime.runtimeStage}</span>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  AI capability
                </span>
                <span className="mt-2 block font-medium">
                  {serverSummary.health.ai.status} · {serverSummary.health.ai.reason}
                </span>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  Release ready
                </span>
                <span className="mt-2 block font-medium">
                  {formatCount(governanceOverview.summary.releaseReadyPromptVersions)} prompt
                  versions are currently release-ready.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Highest-pressure surfaces</CardDescription>
              <CardTitle>Attention queue</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {attentionQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm leading-6">
                  <p className="font-medium">No high-pressure queue items are visible</p>
                  <p className="text-muted-foreground mt-2">
                    The current slice does not show runtime failures, approval pressure, or eval
                    regressions that need immediate triage.
                  </p>
                </div>
              ) : (
                attentionQueue.map((item) => (
                  <Link
                    className="rounded-lg border p-4 transition-colors hover:bg-accent/60"
                    href={item.href as Route}
                    key={`${item.label}:${item.title}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.label}</Badge>
                      <Badge variant="secondary">{item.badge}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">{item.detail}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Latest high-impact trail</CardDescription>
              <CardTitle>Recent evidence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recentEvidence.map((row) => (
                <Link
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/60"
                  href={`/dashboard/observe/runs?auditId=${row.id}` as Route}
                  key={row.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.status === 'success' ? 'outline' : 'secondary'}>
                      {row.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {row.action}:{row.subject}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {row.toolId} · Request {row.requestId ?? 'not captured'}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Lower-weight runtime context</CardDescription>
              <CardTitle>Runtime map</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">
                Agents: {serverSummary.runtime.enabledAgentCount} enabled /{' '}
                {serverSummary.runtime.agentCount} registered
              </div>
              <div className="rounded-lg border p-4">
                Tools: {serverSummary.runtime.toolCount} registered tool surfaces
              </div>
              <div className="rounded-lg border p-4">
                Workflows: {serverSummary.runtime.workflowCount} active workflow entries
              </div>
              <div className="rounded-lg border p-4">
                Jobs: {serverSummary.health.jobs.status} · {serverSummary.health.jobs.detail}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Release evidence posture</CardDescription>
              <CardTitle>Release pipeline</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">Prompt draft → Eval → Approval → Release</div>
              <div className="rounded-lg border p-4">
                Release-ready prompt versions:{' '}
                {formatCount(governanceOverview.summary.releaseReadyPromptVersions)}
              </div>
              <div className="rounded-lg border p-4">
                Total eval experiments:{' '}
                {formatCount(governanceOverview.summary.totalEvalExperiments)}
              </div>
              <div className="rounded-lg border p-4">
                Human overrides in current governance slice:{' '}
                {formatCount(governanceOverview.summary.humanOverrideCount)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
