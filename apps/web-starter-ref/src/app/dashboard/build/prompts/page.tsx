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

interface BuildPromptsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Prompt 工作台',
    sections: [
      {
        title: '页面用途',
        description: '把 Prompt 发布态势、关联评测证据和版本压力汇总到同一个面向构建者的工作台。',
      },
      {
        title: '操作边界',
        description: '这个页面用于解释接下来该复核哪个 Prompt 以及原因，但激活仍属于治理工作流。',
      },
    ],
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

function resolveReviewToneLabel(tone: 'critical' | 'neutral' | 'warning'): string {
  if (tone === 'critical') {
    return '严重'
  }

  if (tone === 'warning') {
    return '警告'
  }

  return '稳定'
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
      return '复核接管'
    case 'review_release_gate':
      return '复核门禁'
    default:
      return '观察'
  }
}

export default async function BuildPromptsPage({
  searchParams,
}: BuildPromptsPageProps): Promise<ReactNode> {
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
      pageTitle="Prompt 工作台"
      pageDescription="面向构建者的 Prompt 治理工作面，包含复核队列、版本态势与关联证据。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="prompt-keys"
            detail="当前切片中可见的 Prompt 治理键。"
            label="Prompt 键"
            value={formatCount(overview.summary.totalPromptKeys)}
          />
          <MetricCard
            badge="release-ready"
            detail="当前已满足发布门禁检查的 Prompt 版本。"
            label="就绪版本"
            value={formatCount(overview.summary.releaseReadyPromptVersions)}
          />
          <MetricCard
            badge="failure-audit"
            detail="与 Prompt 复核压力相关联的失败事件。"
            label="失败事件"
            value={formatCount(overview.summary.promptFailureEvents)}
            variant={overview.summary.promptFailureEvents > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="human-loop"
            detail="与当前 Prompt 切片相关的人工接管次数。"
            label="人工接管"
            value={formatCount(overview.summary.humanOverrideCount)}
            variant={overview.summary.humanOverrideCount > 0 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,1fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>筛选</CardDescription>
                <CardTitle>Prompt 队列搜索</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/build/prompts"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_auto]"
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
                      href="/dashboard/build/prompts"
                    >
                      重置
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>复核队列</CardDescription>
                <CardTitle>Prompt 复核优先级</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>当前选择已回退到首个可见 Prompt</AlertTitle>
                      <AlertDescription>
                        之前选中的 Prompt
                        键已经不在当前切片中，所以构建者详情面板回退到了第一条可见行。
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {overview.reviewQueue.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/build/prompts', label: '重置 Prompt 搜索' }}
                      description={
                        hasActiveFilters
                          ? '当前 Prompt 键查询没有匹配任何面向构建者的复核项。先重置搜索，再判断队列是否真的已经清空。'
                          : '这个切片里当前还没有可见 Prompt 治理项。等待下一条复核项，或确认 Prompt 证据是否正在产出。'
                      }
                      title={
                        hasActiveFilters ? '没有 Prompt 项匹配当前查询' : '当前没有可见 Prompt 项'
                      }
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
                            <TableHead>复核</TableHead>
                            <TableHead>Version</TableHead>
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
                                        '/dashboard/build/prompts',
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
                                  <div className="grid gap-2">
                                    <Badge variant="secondary">
                                      {resolveReviewActionLabel(entry.reviewAction)}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">
                                      {resolveReviewToneLabel(entry.tone)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="grid gap-1">
                                    <span>v{entry.latestVersion.version}</span>
                                    <span className="text-muted-foreground text-xs">
                                      {entry.latestVersion.status}
                                    </span>
                                  </div>
                                </TableCell>
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
                          ? createDashboardHref('/dashboard/build/prompts', resolvedSearchParams, {
                              page: String(overview.pagination.page + 1),
                              promptKey: selectedPromptKey ?? undefined,
                            })
                          : undefined
                      }
                      page={overview.pagination.page}
                      pageSize={overview.pagination.pageSize}
                      previousHref={
                        overview.pagination.page > 1
                          ? createDashboardHref('/dashboard/build/prompts', resolvedSearchParams, {
                              page: String(overview.pagination.page - 1),
                              promptKey: selectedPromptKey ?? undefined,
                            })
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
              <CardDescription>选中 Prompt</CardDescription>
              <CardTitle>{selectedReview?.promptKey ?? '选择一个 Prompt'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedReview ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {resolveReviewActionLabel(selectedReview.reviewItem.reviewAction)}
                    </Badge>
                    <Badge variant="outline">
                      v{selectedReview.reviewItem.latestVersion.version}
                    </Badge>
                    <Badge variant="outline">
                      评测:
                      {selectedReview.linkedEval.lastRunStatus ??
                        selectedReview.linkedEval.evidenceStatus ??
                        '无'}
                    </Badge>
                  </div>

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        发布态势
                      </p>
                      <div className="grid gap-2">
                        <p>复核原因: {selectedReview.reviewItem.reviewReason}</p>
                        <p>已配置关联评测: {selectedReview.linkedEval.configured ? '是' : '否'}</p>
                        <p>
                          最新发布动作:{' '}
                          {selectedReview.latestReleaseAudit?.summary.latestAction ?? '未记录'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        证据态势
                      </p>
                      <div className="grid gap-2">
                        <p>
                          最新评测:{' '}
                          {selectedReview.linkedEval.evalName ??
                            selectedReview.linkedEval.evalKey ??
                            '未关联'}
                        </p>
                        <p>
                          回滚事件:{' '}
                          {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}
                        </p>
                        <p>
                          变更字段:{' '}
                          {selectedReview.compareToPrevious?.summary.changedFields.join(', ') ??
                            '无'}
                        </p>
                        <p>
                          历史版本数: {formatCount(selectedReview.history.summary.totalVersions)}
                        </p>
                        <p>
                          已就绪发布版本:{' '}
                          {formatCount(selectedReview.history.summary.releaseReadyCount)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        构建者备注
                      </p>
                      <div className="grid gap-2">
                        <p>状态: {selectedReview.reviewItem.latestVersion.status}</p>
                        <p>
                          当前激活版本 ID: {selectedReview.history.summary.activeVersionId ?? '无'}
                        </p>
                        <p>
                          发布原因:{' '}
                          {selectedReview.reviewItem.latestVersion.releaseReason ??
                            '已满足发布条件'}
                        </p>
                        <p>
                          关联评测得分:{' '}
                          {selectedReview.linkedEval.evidenceScoreAverage === null
                            ? '暂无'
                            : `${Math.round(selectedReview.linkedEval.evidenceScoreAverage * 100)}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="选择一个 Prompt 键，查看版本态势、发布压力和关联评测证据。"
                  title="当前没有选中 Prompt"
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
