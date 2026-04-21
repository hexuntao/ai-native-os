import type { AiGovernanceOverview, PromptGovernanceReview } from '@ai-native-os/shared'
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
  createDashboardHref,
  type DashboardListFilters,
  type DashboardSearchParams,
} from '@/lib/management'

interface ApprovalsWorkbenchPageProps {
  filters: DashboardListFilters
  overview: AiGovernanceOverview
  resolvedSearchParams: DashboardSearchParams
  selectedReview: PromptGovernanceReview | null
  selectedPromptKey: string | null
}

function resolveApprovalLabel(action: string): string {
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

export function ApprovalsWorkbenchPage({
  filters,
  overview,
  resolvedSearchParams,
  selectedReview,
  selectedPromptKey,
}: ApprovalsWorkbenchPageProps): ReactNode {
  const assistantHandoff = resolveCopilotPageHandoff('/govern/approvals')

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
          label: 'Selected item',
          value: selectedPromptKey ?? 'No approval selected',
        },
      ]}
      description="Approval Queue 负责把 release gate、eval evidence、failure audit 和 rollback chain 汇成一条人工复核链路。"
      eyebrow="Govern"
      signals={[
        {
          badge: 'queue',
          detail: '当前治理切片里待复核的 Prompt 治理条目总数。',
          label: 'Approval items',
          tone: overview.reviewQueue.length > 0 ? 'warning' : 'neutral',
          value: formatCount(overview.reviewQueue.length),
        },
        {
          badge: 'release-ready',
          detail: '当前已满足发布门禁的 Prompt 版本数量。',
          label: 'Ready versions',
          tone: overview.summary.releaseReadyPromptVersions > 0 ? 'positive' : 'neutral',
          value: formatCount(overview.summary.releaseReadyPromptVersions),
        },
        {
          badge: 'failures',
          detail: '当前治理切片累计的失败事件数量。',
          label: 'Failure pressure',
          tone: overview.summary.promptFailureEvents > 0 ? 'warning' : 'neutral',
          value: formatCount(overview.summary.promptFailureEvents),
        },
        {
          badge: 'human-loop',
          detail: '当前治理切片里记录到的人工 override 数量。',
          label: 'Overrides',
          tone: overview.summary.humanOverrideCount > 0 ? 'warning' : 'neutral',
          value: formatCount(overview.summary.humanOverrideCount),
        },
      ]}
      title="Approval Queue"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
        <div className="grid gap-4">
          <form
            action="/govern/approvals"
            aria-label="Approval filters"
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
                href="/govern/approvals"
              >
                Reset
              </a>
            </div>
          </form>

          <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Approval queue
              </p>
              <CardTitle className="text-xl">Governance review priorities</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              {overview.reviewQueue.length === 0 ? (
                <div className="p-6">
                  <SurfaceStatePanel
                    actionHref="/govern/approvals"
                    actionLabel="Reset filters"
                    description="当前筛选条件下没有治理审批项。先放宽搜索范围，再决定是否进入具体证据查看。"
                    eyebrow="Approval empty state"
                    title="No approval items"
                    tone="neutral"
                  />
                </div>
              ) : (
                <div className="grid gap-4 p-4">
                  <ResponsiveTableRegion label="Approval queue" minWidthClassName="min-w-[62rem]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prompt key</TableHead>
                          <TableHead>Action</TableHead>
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
                              <a
                                className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                                href={createDashboardHref(
                                  '/govern/approvals',
                                  resolvedSearchParams,
                                  {
                                    page: undefined,
                                    promptKey: entry.promptKey,
                                  },
                                )}
                              >
                                {entry.promptKey}
                              </a>
                            </TableCell>
                            <TableCell>
                              <Badge variant="accent">
                                {resolveApprovalLabel(entry.reviewAction)}
                              </Badge>
                            </TableCell>
                            <TableCell>v{entry.latestVersion.version}</TableCell>
                            <TableCell>{formatCount(entry.failureCount)}</TableCell>
                            <TableCell>
                              {entry.latestVersion.evalEvidence?.evalKey ?? 'not linked'}
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
                        ? createDashboardHref('/govern/approvals', resolvedSearchParams, {
                            page: String(overview.pagination.page + 1),
                            promptKey: selectedPromptKey ?? undefined,
                          })
                        : undefined
                    }
                    page={overview.pagination.page}
                    pageSize={overview.pagination.pageSize}
                    previousHref={
                      overview.pagination.page > 1
                        ? createDashboardHref('/govern/approvals', resolvedSearchParams, {
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

        <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Evidence bundle
            </p>
            <CardTitle className="text-xl">
              {selectedReview?.promptKey ?? 'Select an approval item'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-5">
            {selectedReview ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="accent">
                    {resolveApprovalLabel(selectedReview.reviewItem.reviewAction)}
                  </Badge>
                  <Badge variant="secondary">
                    latest:v{selectedReview.reviewItem.latestVersion.version}
                  </Badge>
                  <Badge variant="secondary">
                    eval:
                    {selectedReview.linkedEval.lastRunStatus ??
                      selectedReview.linkedEval.evidenceStatus ??
                      'none'}
                  </Badge>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {selectedReview.reviewItem.reviewReason}
                </p>

                <div className="grid gap-3">
                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Policy checks
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <p>
                        linked eval configured:{' '}
                        {selectedReview.linkedEval.configured ? 'yes' : 'no'}
                      </p>
                      <p>
                        release gate rejection:{' '}
                        {selectedReview.failureAudit.summary.hasReleaseGateRejection ? 'yes' : 'no'}
                      </p>
                      <p>
                        rollback events:{' '}
                        {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Evidence
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <p>
                        latest eval:{' '}
                        {selectedReview.linkedEval.evalName ??
                          selectedReview.linkedEval.evalKey ??
                          'not linked'}
                      </p>
                      <p>
                        latest release action:{' '}
                        {selectedReview.latestReleaseAudit?.summary.latestAction ?? 'not recorded'}
                      </p>
                      <p>
                        compare changed fields:{' '}
                        {selectedReview.compareToPrevious?.summary.changedFields.join(', ') ??
                          'none'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Recommendation
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      先复核 failure audit 和 linked eval，再决定是否推进
                      activation；当前工作台只负责证据聚合，不直接执行审批写动作。
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <SurfaceStatePanel
                description="从左侧队列选择一条治理项后，这里会展示它的 evidence bundle、policy checks 和最小安全下一步。"
                eyebrow="Approval detail"
                title="No approval selected"
                tone="neutral"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </StatusWorkbenchPage>
  )
}
