import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmptyStateCard } from '@/components/control-plane/empty-state-card'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import type { InfobarContent } from '@/components/ui/infobar'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createAiGovernanceFilterState,
  createDashboardHref,
  type DashboardSearchParams,
  readSearchParam,
} from '@/lib/management'
import { loadAiGovernanceOverview, loadPromptGovernanceReview } from '@/lib/server-management'
import { cn } from '@/lib/utils'

interface GovernApprovalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: '审批队列',
    sections: [
      {
        title: '页面用途',
        description:
          '先审视治理队列压力，再逐条检查证据包，判断 Prompt 是否已经可以激活或仍需继续排查。',
      },
      {
        title: '操作边界',
        description:
          '这个队列不会直接执行发布写入。它把发布门禁、评测证据、失败审计和回滚链压缩成一个人工复核面。',
      },
    ],
  }
}

function resolveApprovalLabel(action: string): string {
  switch (action) {
    case 'activate_ready_version':
      return '激活'
    case 'attach_eval_evidence':
      return '补充评测'
    case 'investigate_exception':
      return '调查'
    case 'review_override':
      return '复核接管'
    case 'review_release_gate':
      return '复核门禁'
    default:
      return '观察'
  }
}

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

export default async function GovernApprovalsPage({
  searchParams,
}: GovernApprovalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiGovernanceFilterState(resolvedSearchParams)
  const overview = await loadAiGovernanceOverview(filters)
  const requestedPromptKey = readSearchParam(resolvedSearchParams, 'promptKey')
  const selectedPromptKey = resolveSelectedPromptKey(
    resolvedSearchParams,
    overview.reviewQueue.map((entry) => entry.promptKey),
  )
  const selectedReview = selectedPromptKey
    ? await loadPromptGovernanceReview(selectedPromptKey)
    : null
  const hasActiveFilters = Boolean(filters.search)
  const selectionFellBack = Boolean(
    requestedPromptKey &&
      overview.reviewQueue.length > 0 &&
      !overview.reviewQueue.some((entry) => entry.promptKey === requestedPromptKey),
  )

  return (
    <PageContainer
      pageTitle="审批队列"
      pageDescription="在同一治理复核面中查看发布门禁、评测证据、失败审计与回滚链。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="queue"
            detail="等待人工复核的 Prompt 治理项。"
            label="审批项"
            value={formatCount(overview.reviewQueue.length)}
            variant={overview.reviewQueue.length > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="release-ready"
            detail="当前已满足发布门禁检查的 Prompt 版本。"
            label="就绪版本"
            value={formatCount(overview.summary.releaseReadyPromptVersions)}
          />
          <MetricCard
            badge="failures"
            detail="对当前队列切片造成压力的失败事件。"
            label="失败压力"
            value={formatCount(overview.summary.promptFailureEvents)}
            variant={overview.summary.promptFailureEvents > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="human-loop"
            detail="当前治理切片中记录到的人工接管次数。"
            label="人工接管"
            value={formatCount(overview.summary.humanOverrideCount)}
            variant={overview.summary.humanOverrideCount > 0 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>筛选</CardDescription>
                <CardTitle>队列搜索</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/govern/approvals"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedPromptKey ? (
                    <input name="promptKey" type="hidden" value={selectedPromptKey} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="search">Prompt 键搜索</FieldLabel>
                    <Input
                      defaultValue={filters.search}
                      id="search"
                      name="search"
                      placeholder="admin.copilot.answer"
                    />
                  </Field>

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/govern/approvals"
                    >
                      重置
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>审批队列</CardDescription>
                <CardTitle>治理复核优先级</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>当前选择已回退到首个可见审批项</AlertTitle>
                      <AlertDescription>
                        之前选中的 Prompt
                        键已经不在当前切片中，所以证据面板回退到了第一条可见队列项。
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {overview.reviewQueue.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/govern/approvals', label: '重置队列搜索' }}
                      description={
                        hasActiveFilters
                          ? '当前 Prompt 键搜索没有匹配的审批项。先重置查询，再判断队列是否真的已经清空。'
                          : '这个切片里暂时没有可见审批项。要么队列已经清空，要么发布证据还没有进入当前视图。'
                      }
                      title={hasActiveFilters ? '没有审批项匹配当前查询' : '当前没有可见审批项'}
                      tone={hasActiveFilters ? 'no-match' : 'no-data'}
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prompt 键</TableHead>
                            <TableHead>动作</TableHead>
                            <TableHead>版本</TableHead>
                            <TableHead>失败数</TableHead>
                            <TableHead>关联评测</TableHead>
                            <TableHead>更新时间</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.reviewQueue.map((entry) => {
                            const isSelected = entry.promptKey === selectedPromptKey

                            return (
                              <TableRow
                                className={cn(isSelected && 'bg-sidebar-accent/45')}
                                key={entry.promptKey}
                              >
                                <TableCell>
                                  <Link
                                    className={cn(
                                      'font-medium underline-offset-4 hover:underline',
                                      isSelected && 'text-foreground',
                                    )}
                                    href={
                                      createDashboardHref(
                                        '/dashboard/govern/approvals',
                                        resolvedSearchParams,
                                        {
                                          page: undefined,
                                          promptKey: entry.promptKey,
                                        },
                                      ) as Route
                                    }
                                  >
                                    {entry.promptKey}
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {resolveApprovalLabel(entry.reviewAction)}
                                  </Badge>
                                </TableCell>
                                <TableCell>v{entry.latestVersion.version}</TableCell>
                                <TableCell>{formatCount(entry.failureCount)}</TableCell>
                                <TableCell>
                                  {entry.latestVersion.evalEvidence?.evalKey ?? '未关联'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDateTime(entry.latestVersion.updatedAt)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        overview.pagination.page < overview.pagination.totalPages
                          ? createDashboardHref(
                              '/dashboard/govern/approvals',
                              resolvedSearchParams,
                              {
                                page: String(overview.pagination.page + 1),
                                promptKey: selectedPromptKey ?? undefined,
                              },
                            )
                          : undefined
                      }
                      page={overview.pagination.page}
                      pageSize={overview.pagination.pageSize}
                      previousHref={
                        overview.pagination.page > 1
                          ? createDashboardHref(
                              '/dashboard/govern/approvals',
                              resolvedSearchParams,
                              {
                                page: String(overview.pagination.page - 1),
                                promptKey: selectedPromptKey ?? undefined,
                              },
                            )
                          : undefined
                      }
                      total={overview.pagination.total}
                      totalPages={overview.pagination.totalPages}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>证据包</CardDescription>
              <CardTitle>{selectedReview?.promptKey ?? '选择一个审批项'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedReview ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {resolveApprovalLabel(selectedReview.reviewItem.reviewAction)}
                    </Badge>
                    <Badge variant="outline">
                      最新:v{selectedReview.reviewItem.latestVersion.version}
                    </Badge>
                    <Badge variant="outline">
                      评测:
                      {selectedReview.linkedEval.lastRunStatus ??
                        selectedReview.linkedEval.evidenceStatus ??
                        '无'}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground text-sm leading-7">
                    {selectedReview.reviewItem.reviewReason}
                  </p>

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        决策摘要
                      </p>
                      <div className="grid gap-2">
                        <p>
                          复核动作: {resolveApprovalLabel(selectedReview.reviewItem.reviewAction)}
                        </p>
                        <p>复核原因: {selectedReview.reviewItem.reviewReason}</p>
                        <p>最新版本: v{selectedReview.reviewItem.latestVersion.version}</p>
                        <p>最新状态: {selectedReview.reviewItem.latestVersion.status}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        策略检查
                      </p>
                      <div className="grid gap-2">
                        <p>已配置关联评测: {selectedReview.linkedEval.configured ? '是' : '否'}</p>
                        <p>
                          发布门禁拒绝:{' '}
                          {selectedReview.failureAudit.summary.hasReleaseGateRejection
                            ? '是'
                            : '否'}
                        </p>
                        <p>
                          回滚事件:{' '}
                          {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        评测 / 发布证据
                      </p>
                      <div className="grid gap-2">
                        <p>
                          最新评测:{' '}
                          {selectedReview.linkedEval.evalName ??
                            selectedReview.linkedEval.evalKey ??
                            '未关联'}
                        </p>
                        <p>
                          最新发布动作:{' '}
                          {selectedReview.latestReleaseAudit?.summary.latestAction ?? '未记录'}
                        </p>
                        <p>
                          对比变更字段:{' '}
                          {selectedReview.compareToPrevious?.summary.changedFields.join(', ') ??
                            '无'}
                        </p>
                        <p>
                          发布审计事件:{' '}
                          {formatCount(
                            selectedReview.latestReleaseAudit?.summary.approvalEventCount ?? 0,
                          )}
                        </p>
                        <p>
                          失败事件:{' '}
                          {formatCount(selectedReview.failureAudit.summary.totalFailureEventCount)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        回滚 / 对比上下文
                      </p>
                      <div className="grid gap-2">
                        <p>
                          上一个版本: {selectedReview.compareToPrevious?.baseline.version ?? '无'}
                        </p>
                        <p>
                          变更字段数:{' '}
                          {selectedReview.compareToPrevious?.summary.totalChangedFields ?? 0}
                        </p>
                        <p>
                          最近回滚目标:{' '}
                          {selectedReview.rollbackChain.summary.latestRollbackTargetVersionNumber ??
                            '无'}
                        </p>
                        <p>
                          历史版本数: {formatCount(selectedReview.history.summary.totalVersions)}
                        </p>
                        <p>
                          建议：先查看失败审计和关联评测，再决定当前 Prompt
                          已可激活，还是仍然证据不足。
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="从队列中选择一个审批项，查看决策摘要、策略检查、发布证据与回滚上下文。"
                  title="当前没有选中审批项"
                  tone="no-data"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
