import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { AssistantHandoffCard, SurfaceStatePanel } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createAiGovernanceFilterState,
  createDashboardHref,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiGovernanceOverview, loadPromptGovernanceReview } from '@/lib/server-management'

interface PromptGovernancePageProps {
  searchParams: Promise<DashboardSearchParams>
}

/**
 * 统一治理语气到可读标签，避免工作台继续显示底层枚举值。
 */
function resolveReviewToneLabel(tone: 'critical' | 'neutral' | 'warning'): string {
  if (tone === 'critical') {
    return 'Critical'
  }

  if (tone === 'warning') {
    return 'Warning'
  }

  return 'Stable'
}

/**
 * 为当前页选择默认 Prompt 治理键，优先保留用户显式选择，否则回落到 review queue 第一项。
 */
function resolveSelectedPromptKey(
  searchParams: DashboardSearchParams,
  promptKeys: readonly string[],
): string | null {
  const promptKeyValue = searchParams.promptKey
  const promptKey = Array.isArray(promptKeyValue) ? promptKeyValue[0] : promptKeyValue

  if (promptKey && promptKeys.includes(promptKey)) {
    return promptKey
  }

  return promptKeys[0] ?? null
}

/**
 * 把当前页的治理动作压缩成状态条标签，便于快速扫描 review queue。
 */
function resolveReviewActionLabel(action: string): string {
  switch (action) {
    case 'activate_ready_version':
      return 'Activate'
    case 'attach_eval_evidence':
      return 'Attach eval'
    case 'investigate_exception':
      return 'Investigate'
    case 'review_override':
      return 'Review override'
    case 'review_release_gate':
      return 'Review gate'
    default:
      return 'Watch'
  }
}

export default async function PromptGovernancePage({
  searchParams,
}: PromptGovernancePageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiGovernanceFilterState(resolvedSearchParams)
  const overview = await loadAiGovernanceOverview(filters)
  const selectedPromptKey = resolveSelectedPromptKey(
    resolvedSearchParams,
    overview.reviewQueue.map((entry) => entry.promptKey),
  )
  const selectedReview = selectedPromptKey
    ? await loadPromptGovernanceReview(selectedPromptKey)
    : null
  const assistantHandoff = resolveCopilotPageHandoff('/ai/prompts')

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
          label: 'Queue search',
          value: filters.search ?? 'All prompt keys',
        },
        {
          label: 'Selected prompt',
          value: selectedPromptKey ?? 'No prompt selected',
        },
      ]}
      description="Prompt 治理工作台统一连接 release gate、失败审计、回滚链和评测证据，让操作员先做复核与归因，再决定是否推进发布动作。"
      eyebrow="AI Module"
      signals={[
        {
          badge: 'prompt-keys',
          detail: '当前治理总览下可见的 Prompt 治理键数量。',
          label: 'Prompt keys',
          tone: overview.summary.totalPromptKeys > 0 ? 'positive' : 'neutral',
          value: formatCount(overview.summary.totalPromptKeys),
        },
        {
          badge: 'release-ready',
          detail: '所有 Prompt 版本中已经满足发布门禁的版本数量。',
          label: 'Ready versions',
          tone: overview.summary.releaseReadyPromptVersions > 0 ? 'positive' : 'warning',
          value: formatCount(overview.summary.releaseReadyPromptVersions),
        },
        {
          badge: 'failure-audit',
          detail: '当前治理切片累计记录的失败事件总数，包含 rejection 与 exception。',
          label: 'Failure events',
          tone: overview.summary.promptFailureEvents > 0 ? 'warning' : 'positive',
          value: formatCount(overview.summary.promptFailureEvents),
        },
        {
          badge: 'human-loop',
          detail: '当前治理切片里出现人工 override 的反馈总次数。',
          label: 'Human overrides',
          tone: overview.summary.humanOverrideCount > 0 ? 'warning' : 'neutral',
          value: formatCount(overview.summary.humanOverrideCount),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Governance strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={filters.search ? 'accent' : 'secondary'}>
                search:{filters.search ?? 'all'}
              </Badge>
              <Badge variant="accent">
                evals:{overview.summary.evalConfigured ? 'configured' : 'degraded'}
              </Badge>
              <Badge
                variant={
                  overview.summary.exceptionEventCount > 0 ||
                  overview.summary.rejectionEventCount > 0
                    ? 'accent'
                    : 'secondary'
                }
              >
                failures:
                {overview.summary.exceptionEventCount + overview.summary.rejectionEventCount}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Governance boundary</p>
            <p className="text-sm leading-6 text-muted-foreground">
              当前页面是 Prompt 治理读模型，不直接执行激活或回滚；它负责把 release gate、
              compare、rollback、failure audit 和 linked eval 信号收束到同一工作台。
            </p>
          </div>
        </div>
      }
      title="Prompt Governance"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,1fr)]">
        <div className="grid gap-4">
          <form
            action="/ai/prompts"
            aria-label="Prompt governance filters"
            className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.2fr)_auto]"
            method="GET"
          >
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
            {selectedPromptKey ? (
              <input name="promptKey" type="hidden" value={selectedPromptKey} />
            ) : null}

            <Field>
              <FieldLabel htmlFor="search">Prompt key search</FieldLabel>
              <Input
                defaultValue={filters.search}
                id="search"
                name="search"
                placeholder="admin.copilot.answer"
              />
            </Field>

            <div className="flex items-end gap-3">
              <a
                className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
                href="/ai/prompts"
              >
                Reset
              </a>
            </div>
          </form>

          <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Review queue
              </p>
              <CardTitle className="text-xl">Prompt review priorities</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              {overview.reviewQueue.length === 0 ? (
                <div className="p-6">
                  <SurfaceStatePanel
                    actionHref="/ai/prompts"
                    actionLabel="Reset filters"
                    description="当前筛选条件下没有命中的 Prompt 治理键。先放宽搜索范围，再决定是否进入具体版本审阅。"
                    eyebrow="Prompt governance empty state"
                    hints={[
                      '如果你预期这里应该有数据，先确认 promptKey 搜索条件是否过窄。',
                      '如果这是新环境，先创建 Prompt 版本或执行评测，治理工作台才会形成真实队列。',
                    ]}
                    title="No prompt governance items"
                    tone="neutral"
                  />
                </div>
              ) : (
                <div className="grid gap-4 p-4">
                  <ResponsiveTableRegion
                    label="Prompt governance review queue"
                    minWidthClassName="min-w-[64rem]"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prompt key</TableHead>
                          <TableHead>Review</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Failures</TableHead>
                          <TableHead>Linked eval</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overview.reviewQueue.map((entry) => (
                          <TableRow key={entry.promptKey}>
                            <TableCell>
                              <div className="grid gap-2">
                                <a
                                  className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                                  href={createDashboardHref('/ai/prompts', resolvedSearchParams, {
                                    page: undefined,
                                    promptKey: entry.promptKey,
                                  })}
                                >
                                  {entry.promptKey}
                                </a>
                                <p className="max-w-[24rem] text-xs leading-5 text-muted-foreground">
                                  {entry.reviewReason}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-2">
                                <Badge variant="accent">
                                  {resolveReviewActionLabel(entry.reviewAction)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {resolveReviewToneLabel(entry.tone)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-1 text-sm">
                                <span>v{entry.latestVersion.version}</span>
                                <span className="text-muted-foreground">
                                  {entry.latestVersion.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-1 text-sm">
                                <span>{formatCount(entry.failureCount)}</span>
                                <span className="text-muted-foreground">
                                  {entry.latestFailureKind ?? 'none'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-1 text-sm">
                                <span>
                                  {entry.latestVersion.evalEvidence?.evalKey ?? 'not linked'}
                                </span>
                                <span className="text-muted-foreground">
                                  {entry.latestVersion.evalEvidence?.status ?? 'no evidence'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(entry.latestVersion.updatedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableRegion>

                  <PaginationControls
                    nextHref={
                      overview.pagination.page < overview.pagination.totalPages
                        ? createDashboardHref('/ai/prompts', resolvedSearchParams, {
                            page: String(overview.pagination.page + 1),
                            promptKey: selectedPromptKey ?? undefined,
                          })
                        : undefined
                    }
                    page={overview.pagination.page}
                    pageSize={overview.pagination.pageSize}
                    previousHref={
                      overview.pagination.page > 1
                        ? createDashboardHref('/ai/prompts', resolvedSearchParams, {
                            page: String(overview.pagination.page - 1),
                            promptKey: selectedPromptKey ?? undefined,
                          })
                        : undefined
                    }
                    total={overview.pagination.total}
                    totalPages={overview.pagination.totalPages}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {selectedReview ? (
            <>
              <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
                <CardHeader className="gap-2 border-b border-border/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Selected prompt
                  </p>
                  <CardTitle className="text-xl">{selectedReview.promptKey}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="accent">
                      action:{resolveReviewActionLabel(selectedReview.reviewItem.reviewAction)}
                    </Badge>
                    <Badge variant="secondary">
                      latest:v{selectedReview.reviewItem.latestVersion.version}
                    </Badge>
                    <Badge variant="secondary">
                      active:
                      {selectedReview.history.summary.latestVersionNumber ?? 'none'}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {selectedReview.reviewItem.reviewReason}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Linked eval
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {selectedReview.linkedEval.evalName ??
                          selectedReview.linkedEval.evalKey ??
                          'No eval linked'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        last status:{' '}
                        {selectedReview.linkedEval.lastRunStatus ??
                          selectedReview.linkedEval.evidenceStatus ??
                          'none'}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Release audit
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        latest:{' '}
                        {selectedReview.latestReleaseAudit?.summary.latestAction ?? 'not recorded'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        events:{' '}
                        {formatCount(
                          selectedReview.latestReleaseAudit?.summary.approvalEventCount ?? 0,
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
                <CardHeader className="gap-2 border-b border-border/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Governance detail
                  </p>
                  <CardTitle className="text-xl">History, failure, and rollback summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-5">
                  <div className="grid gap-3">
                    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Compare to previous
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {selectedReview.compareToPrevious
                          ? `${selectedReview.compareToPrevious.target.id.slice(0, 8)} vs ${selectedReview.compareToPrevious.baseline.id.slice(0, 8)}`
                          : 'No previous version to compare'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedReview.compareToPrevious
                          ? selectedReview.compareToPrevious.summary.changedFields.join(', ') ||
                            'Diff summary unavailable'
                          : '当前 Prompt 只有一个版本，尚未形成版本差异。'}
                      </p>
                    </div>

                    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Failure audit
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {formatCount(selectedReview.failureAudit.summary.totalFailureEventCount)}{' '}
                        events
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        latest kind:{' '}
                        {selectedReview.failureAudit.summary.latestFailureKind ?? 'none'} · gate
                        rejection:{' '}
                        {selectedReview.failureAudit.summary.hasReleaseGateRejection ? 'yes' : 'no'}
                      </p>
                    </div>

                    <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Rollback chain
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}{' '}
                        rollback events
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        latest target version:{' '}
                        {selectedReview.rollbackChain.summary.latestRollbackTargetVersionNumber ??
                          'none'}
                      </p>
                    </div>
                  </div>

                  <ResponsiveTableRegion
                    hint="时间线较密时可横向滚动查看更多列。"
                    label="Prompt governance history"
                    minWidthClassName="min-w-[40rem]"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Version</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Release</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedReview.history.versions.slice(0, 6).map((version) => (
                          <TableRow key={version.id}>
                            <TableCell>v{version.version}</TableCell>
                            <TableCell>{version.status}</TableCell>
                            <TableCell>{version.releaseReason ?? 'ready'}</TableCell>
                            <TableCell>{formatDateTime(version.updatedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableRegion>
                </CardContent>
              </Card>

              <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
                <CardHeader className="gap-2 border-b border-border/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Human loop
                  </p>
                  <CardTitle className="text-xl">Recent AI feedback context</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-5">
                  {overview.recentFeedback.length > 0 ? (
                    overview.recentFeedback.slice(0, 4).map((feedback) => (
                      <div
                        className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4"
                        key={feedback.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{feedback.userAction}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(feedback.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {feedback.feedbackText ??
                            feedback.correction ??
                            'No free-form operator note was recorded for this feedback event.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <SurfaceStatePanel
                      description="当前治理切片还没有最近 AI feedback 记录，说明 human loop 证据仍然偏薄。"
                      eyebrow="Feedback empty state"
                      title="No recent feedback"
                      tone="neutral"
                    />
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <SurfaceStatePanel
              description="当前还没有选中的 Prompt 治理键。先从左侧 review queue 选择一个 Prompt，再查看历史、失败和回滚细节。"
              eyebrow="Prompt governance detail"
              title="Select a prompt key"
              tone="neutral"
            />
          )}
        </div>
      </div>
    </StatusWorkbenchPage>
  )
}
