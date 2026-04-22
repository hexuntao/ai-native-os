import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AiFeedbackDialog } from '@/components/ai/ai-feedback-dialog'
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
  createAiAuditFilterState,
  createDashboardHref,
  type DashboardSearchParams,
  readSearchParam,
} from '@/lib/management'
import { loadAiAuditDetail, loadAiAuditLogsList } from '@/lib/server-management'
import { cn } from '@/lib/utils'

interface ObserveRunsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: '运行与追踪',
    sections: [
      {
        title: '页面用途',
        description: '逐条检查运行时证据，再决定下一步应该进入分诊、审批还是 Prompt 迭代。',
      },
      {
        title: '操作边界',
        description:
          '这个页面只提供只读视图。它暴露执行证据和人工接管，但不会直接修改发布或治理状态。',
        links: [
          {
            title: '打开审批队列',
            url: '/dashboard/govern/approvals',
          },
        ],
      },
    ],
  }
}

function resolveSelectedAuditId(
  searchParams: DashboardSearchParams,
  auditIds: readonly string[],
): string | null {
  const auditIdValue = searchParams.auditId
  const auditId = Array.isArray(auditIdValue) ? auditIdValue[0] : auditIdValue

  if (auditId && auditIds.includes(auditId)) {
    return auditId
  }

  return auditIds[0] ?? null
}

function resolveBadgeVariant(
  status: 'error' | 'forbidden' | 'success',
): 'default' | 'destructive' | 'secondary' {
  if (status === 'error') {
    return 'destructive'
  }

  if (status === 'forbidden') {
    return 'secondary'
  }

  return 'default'
}

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function ObserveRunsPage({
  searchParams,
}: ObserveRunsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const requestedAuditId = readSearchParam(resolvedSearchParams, 'auditId')
  const selectedAuditId = resolveSelectedAuditId(
    resolvedSearchParams,
    payload.data.map((row) => row.id),
  )
  const selectedEntry =
    payload.data.find((row) => row.id === selectedAuditId) ?? payload.data[0] ?? null
  const selectedDetail = selectedEntry ? await loadAiAuditDetail(selectedEntry.id) : null
  const degradedCount = payload.data.filter(
    (row) => row.status === 'error' || row.status === 'forbidden',
  ).length
  const overrideCount = payload.data.filter((row) => row.humanOverride).length
  const feedbackCount = payload.data.reduce((sum, row) => sum + row.feedbackCount, 0)
  const hasActiveFilters = Boolean(filters.search || filters.toolId || filters.status !== 'all')
  const selectionFellBack = Boolean(
    requestedAuditId &&
      payload.data.length > 0 &&
      !payload.data.some((row) => row.id === requestedAuditId),
  )

  return (
    <PageContainer
      pageTitle="运行与追踪"
      pageDescription="面向操作员的执行切片，包含筛选、运行状态与追踪级证据。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="runs"
            detail="当前运行时切片里可见的审计事件总数。"
            label="可见运行"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={degradedCount === 0 ? 'clear' : 'triage'}
            detail="当前切片中结果为错误或禁止的行。"
            label="需要分诊"
            value={formatCount(degradedCount)}
            variant={degradedCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={overrideCount === 0 ? 'none' : 'human-loop'}
            detail="已经被人工接管过的执行。"
            label="人工接管"
            value={formatCount(overrideCount)}
            variant={overrideCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge="feedback"
            detail="与当前页面切片相关联的人工反馈记录。"
            label="反馈记录"
            value={formatCount(feedbackCount)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>筛选</CardDescription>
                <CardTitle>追踪查询</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/observe/runs"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedEntry ? (
                    <input name="auditId" type="hidden" value={selectedEntry.id} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="search">追踪搜索</FieldLabel>
                    <Input
                      defaultValue={filters.search}
                      id="search"
                      name="search"
                      placeholder="请求 ID 或工具"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="status">状态</FieldLabel>
                    <select
                      className={selectClassName}
                      defaultValue={filters.status}
                      id="status"
                      name="status"
                    >
                      <option value="all">全部状态</option>
                      <option value="success">成功</option>
                      <option value="forbidden">禁止</option>
                      <option value="error">错误</option>
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="toolId">工具 ID</FieldLabel>
                    <Input
                      defaultValue={filters.toolId}
                      id="toolId"
                      name="toolId"
                      placeholder="knowledge-semantic-search"
                    />
                  </Field>

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/observe/runs"
                    >
                      重置
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>运行表格</CardDescription>
                <CardTitle>操作员可见执行切片</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>当前选择已回退到首个可见行</AlertTitle>
                      <AlertDescription>
                        之前选中的审计日志已经不在当前切片中，所以详情面板自动回退到第一条可见运行。
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {payload.data.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/observe/runs', label: '重置追踪查询' }}
                      description={
                        hasActiveFilters
                          ? '当前筛选没有匹配的运行时证据。先重置查询，再判断这是预期空缺还是可见性问题。'
                          : '这个路由目前还没有可见的运行时审计记录。等待下一次执行，或确认审计证据是否已经写入。'
                      }
                      title={hasActiveFilters ? '没有运行记录匹配当前查询' : '当前还没有可见运行'}
                      tone={hasActiveFilters ? 'no-match' : 'no-data'}
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>工具</TableHead>
                            <TableHead>动作</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>反馈</TableHead>
                            <TableHead>请求</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payload.data.map((row) => {
                            const isSelected = row.id === selectedEntry?.id

                            return (
                              <TableRow
                                className={cn(isSelected && 'bg-sidebar-accent/45')}
                                key={row.id}
                              >
                                <TableCell className="text-muted-foreground">
                                  <Link
                                    className={cn(
                                      'underline-offset-4 hover:underline',
                                      isSelected && 'font-medium text-foreground',
                                    )}
                                    href={
                                      createDashboardHref(
                                        '/dashboard/observe/runs',
                                        resolvedSearchParams,
                                        {
                                          auditId: row.id,
                                          page: undefined,
                                        },
                                      ) as Route
                                    }
                                  >
                                    {formatDateTime(row.createdAt)}
                                  </Link>
                                </TableCell>
                                <TableCell className="font-medium">{row.toolId}</TableCell>
                                <TableCell>
                                  {row.action}:{row.subject}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={resolveBadgeVariant(row.status)}>
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{row.feedbackCount}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.requestId ?? '无请求 ID'}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        payload.pagination.page < payload.pagination.totalPages
                          ? createDashboardHref('/dashboard/observe/runs', resolvedSearchParams, {
                              page: String(payload.pagination.page + 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      page={payload.pagination.page}
                      pageSize={payload.pagination.pageSize}
                      previousHref={
                        payload.pagination.page > 1
                          ? createDashboardHref('/dashboard/observe/runs', resolvedSearchParams, {
                              page: String(payload.pagination.page - 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      total={payload.pagination.total}
                      totalPages={payload.pagination.totalPages}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>追踪详情</CardDescription>
              <CardTitle>{selectedEntry ? selectedEntry.toolId : '选择一条运行记录'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedEntry ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={resolveBadgeVariant(selectedEntry.status)}>
                      {selectedEntry.status}
                    </Badge>
                    <Badge variant="outline">
                      {selectedEntry.action}:{selectedEntry.subject}
                    </Badge>
                    <Badge variant="outline">
                      人工接管:{selectedEntry.humanOverride ? '是' : '否'}
                    </Badge>
                  </div>

                  <AiFeedbackDialog
                    auditLogId={selectedEntry.id}
                    feedbackCount={selectedEntry.feedbackCount}
                    humanOverride={selectedEntry.humanOverride}
                    latestUserAction={selectedEntry.latestUserAction}
                    toolId={selectedEntry.toolId}
                  />

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        执行摘要
                      </p>
                      <div className="grid gap-2">
                        <p>创建时间: {formatDateTime(selectedEntry.createdAt)}</p>
                        <p>工具 ID: {selectedEntry.toolId}</p>
                        <p>
                          范围: {selectedEntry.action}:{selectedEntry.subject}
                        </p>
                        <p>状态: {selectedEntry.status}</p>
                        <p>
                          操作主体:{' '}
                          {selectedEntry.actorRbacUserId ?? selectedEntry.actorAuthUserId ?? '系统'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        证据 / 元数据
                      </p>
                      <div className="grid gap-2">
                        <p>请求 ID: {selectedEntry.requestId ?? '无'}</p>
                        <p>反馈数: {selectedEntry.feedbackCount}</p>
                        <p>错误信息: {selectedEntry.errorMessage ?? '无'}</p>
                        <p>人工接管: {selectedEntry.humanOverride ? '已进入人工环路' : '无接管'}</p>
                        <p>最新用户动作: {selectedEntry.latestUserAction ?? '无用户动作'}</p>
                        <p>
                          角色:{' '}
                          {selectedEntry.roleCodes.length > 0
                            ? selectedEntry.roleCodes.join(', ')
                            : '无'}
                        </p>
                        <p>来源类型: {selectedDetail?.requestInfo?.sourceType ?? '无'}</p>
                        <p>最近反馈时间: {selectedEntry.latestFeedbackAt ?? '无'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        人工反馈 / 接管
                      </p>
                      <p className="text-muted-foreground mb-3 text-sm leading-6">
                        {selectedEntry.humanOverride
                          ? '这条运行已经跨过人工接管边界。决定它应归入治理还是运行时分诊之前，先查看反馈历史。'
                          : '当前还没有记录人工接管。只有在现有证据不足时，才使用反馈入口继续补充判断。'}
                      </p>
                      {selectedDetail?.feedback.length ? (
                        <div className="grid gap-3">
                          {selectedDetail.feedback.map((feedback) => (
                            <div className="rounded-md border p-3" key={feedback.id}>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{feedback.userAction}</Badge>
                                <Badge variant="outline">
                                  {feedback.accepted ? '已接受' : '已修正'}
                                </Badge>
                              </div>
                              <p className="mt-2 text-muted-foreground">
                                {feedback.feedbackText ?? feedback.correction ?? '没有记录备注。'}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {formatDateTime(feedback.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">当前还没有关联的反馈证据。</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="从表格中选择一条运行记录，查看执行摘要、证据元数据和人工接管态势。"
                  title="当前没有选中运行记录"
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
