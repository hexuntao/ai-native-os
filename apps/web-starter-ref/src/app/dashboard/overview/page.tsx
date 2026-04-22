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
    title: 'AI 运营中心',
    sections: [
      {
        title: '页面用途',
        description: '先用操作员摘要判断最安全的下一步，再进入证据最充分的单一工作台继续处理。',
        links: [
          {
            title: primaryCall.ctaLabel,
            url: primaryCall.ctaHref,
          },
          {
            title: '查看运行追踪',
            url: '/dashboard/observe/runs',
          },
        ],
      },
      {
        title: '操作边界',
        description: '这个页面会压缩运行时、审批与评测压力，但具体判断仍应回到对应工作台完成。',
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
      detail: `${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} 个代理已在运行时注册表中启用。`,
      label: '运行时',
      value: serverSummary.health.status === 'ok' ? '稳定' : '降级',
      variant: serverSummary.health.status === 'ok' ? 'outline' : 'secondary',
    },
    {
      detail:
        governanceOverview.reviewQueue.length === 0
          ? '当前治理切片中没有可见的审批压力。'
          : `${formatCount(governanceOverview.reviewQueue.length)} 个审批项需要人工复核。`,
      label: '发布',
      value: governanceOverview.reviewQueue.length === 0 ? '清空' : '待审队列',
      variant: governanceOverview.reviewQueue.length === 0 ? 'outline' : 'secondary',
    },
    {
      detail:
        failedEvalSuites === 0
          ? '最新可见评测运行保持稳定。'
          : `${formatCount(failedEvalSuites)} 个可见评测套件最近一次运行失败。`,
      label: '评测',
      value: failedEvalSuites === 0 ? '稳定' : '回归',
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
      badge: degradedEntry.status === 'forbidden' ? '禁止' : '错误',
      ctaHref: `/dashboard/observe/runs?auditId=${degradedEntry.id}`,
      ctaLabel: '打开最高风险追踪',
      detail:
        degradedEntry.status === 'forbidden'
          ? '当前审计切片里出现了一个被禁止的运行时事件。升级之前，先确认它是策略边界触发，还是缺失能力导致。'
          : '当前审计切片里出现了一个失败的运行时事件。扩大处理范围之前，先核实执行证据和人工反馈。',
      title: `${degradedEntry.action}:${degradedEntry.subject} 是首个应处理的操作点`,
    }
  }

  if (reviewItem) {
    return {
      badge: resolveReviewActionLabel(reviewItem.reviewAction),
      ctaHref: `/dashboard/govern/approvals?promptKey=${encodeURIComponent(reviewItem.promptKey)}`,
      ctaLabel: '查看首个审批项',
      detail:
        '发布队列仍然需要人工判断。先从最显眼的审批项开始，确认策略、评测和回滚证据是否一致。',
      title: `${reviewItem.promptKey} 正在阻塞发布流程`,
    }
  }

  if (failedEvalSuite) {
    return {
      badge: 'eval regression',
      ctaHref: `/dashboard/improve/evals?search=${encodeURIComponent(failedEvalSuite.id)}`,
      ctaLabel: '检查评测回归',
      detail:
        '当前没有更紧急的运行时或审批压力，但至少有一个评测套件失败。先确认这次回归是否会阻塞下一步发布。',
      title: `${failedEvalSuite.name} 需要继续跟进评测`,
    }
  }

  return {
    badge: serverSummary.health.status === 'ok' ? 'stable' : 'watch',
    ctaHref: '/dashboard/observe/monitor',
    ctaLabel: '检查运行时态势',
    detail: '当前切片看起来整体稳定。用运行时态势和最近证据再确认，没有任何信号正在越过容忍范围。',
    title: '当前没有可见的一级告警',
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
      label: '运行事件',
      priority: 120 - index,
      title: `${row.action}:${row.subject}`,
    }))

  const approvalItems: AttentionQueueItem[] = governanceOverview.reviewQueue
    .slice(0, 3)
    .map((entry, index) => ({
      badge: resolveReviewActionLabel(entry.reviewAction),
      detail: entry.reviewReason,
      href: `/dashboard/govern/approvals?promptKey=${encodeURIComponent(entry.promptKey)}`,
      label: '审批压力',
      priority: 90 - index,
      title: entry.promptKey,
    }))

  const evalItems: AttentionQueueItem[] = evalPayload.data
    .filter((row) => row.lastRunStatus === 'failed')
    .slice(0, 2)
    .map((row, index) => ({
      badge: '失败',
      detail: `${formatCount(row.scorerCount)} 个评分器 · 数据集 ${row.datasetSize ?? '未知'} 行。`,
      href: `/dashboard/improve/evals?search=${encodeURIComponent(row.id)}`,
      label: '评测回归',
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
      return '激活'
    case 'attach_eval_evidence':
      return '补充评测'
    case 'investigate_exception':
      return '调查'
    case 'review_override':
      return '接管'
    case 'review_release_gate':
      return '发布门禁'
    default:
      return '复核'
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
      pageTitle="AI 运营中心"
      pageDescription="面向全局的 AI 运行视图，汇总运行时、治理、评测与最近证据信号。"
      infoContent={createInfoContent(primaryCall)}
    >
      <div className="flex flex-1 flex-col space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">操作摘要</Badge>
                <Badge variant="outline">{primaryCall.badge}</Badge>
              </div>
              <div className="grid gap-3">
                <CardDescription>当前全局结论</CardDescription>
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
                  <Link href="/dashboard/observe/runs">查看运行追踪</Link>
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
              <CardDescription>操作员态势</CardDescription>
              <CardTitle>下一步先看什么</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  运行阶段
                </span>
                <span className="mt-2 block font-medium">{serverSummary.runtime.runtimeStage}</span>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  AI 能力
                </span>
                <span className="mt-2 block font-medium">
                  {serverSummary.health.ai.status} · {serverSummary.health.ai.reason}
                </span>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  发布就绪
                </span>
                <span className="mt-2 block font-medium">
                  当前有 {formatCount(governanceOverview.summary.releaseReadyPromptVersions)} 个
                  Prompt 版本处于发布就绪状态。
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <Card>
            <CardHeader>
              <CardDescription>当前压力最高的工作面</CardDescription>
              <CardTitle>关注队列</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {attentionQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm leading-6">
                  <p className="font-medium">当前没有可见的高压队列项</p>
                  <p className="text-muted-foreground mt-2">
                    当前切片没有出现需要立刻分诊的运行失败、审批压力或评测回归。
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
              <CardDescription>最近的高影响链路</CardDescription>
              <CardTitle>最近证据</CardTitle>
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
                      {row.status === 'success' ? '成功' : row.status === 'error' ? '错误' : '禁止'}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {row.action}:{row.subject}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {row.toolId} · 请求 {row.requestId ?? '未捕获'}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardDescription>次一级运行时上下文</CardDescription>
              <CardTitle>运行时地图</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">
                代理: 已启用 {serverSummary.runtime.enabledAgentCount} / 已注册{' '}
                {serverSummary.runtime.agentCount}
              </div>
              <div className="rounded-lg border p-4">
                工具: {serverSummary.runtime.toolCount} 个已注册工具工作面
              </div>
              <div className="rounded-lg border p-4">
                工作流: {serverSummary.runtime.workflowCount} 个活动工作流入口
              </div>
              <div className="rounded-lg border p-4">
                任务: {serverSummary.health.jobs.status} · {serverSummary.health.jobs.detail}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>发布证据态势</CardDescription>
              <CardTitle>发布流水线</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border p-4">Prompt 草稿 → 评测 → 审批 → 发布</div>
              <div className="rounded-lg border p-4">
                发布就绪 Prompt 版本:{' '}
                {formatCount(governanceOverview.summary.releaseReadyPromptVersions)}
              </div>
              <div className="rounded-lg border p-4">
                评测实验总数: {formatCount(governanceOverview.summary.totalEvalExperiments)}
              </div>
              <div className="rounded-lg border p-4">
                当前治理切片中的人工接管:{' '}
                {formatCount(governanceOverview.summary.humanOverrideCount)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
