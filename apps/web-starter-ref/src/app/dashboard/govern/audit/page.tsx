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

interface GovernAuditPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: '审计台账',
    sections: [
      {
        title: '页面用途',
        description: '在同一份台账中查看工具级治理证据，包括禁止调用、运行错误与人工接管。',
      },
      {
        title: '操作边界',
        description: '这个页面用于解释审计压力，但不能替代审批复核或 Prompt 发布控制。',
      },
    ],
  }
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

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function GovernAuditPage({
  searchParams,
}: GovernAuditPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const requestedAuditId = readSearchParam(resolvedSearchParams, 'auditId')
  const forbiddenCount = payload.data.filter((row) => row.status === 'forbidden').length
  const overrideCount = payload.data.filter((row) => row.humanOverride).length
  const errorCount = payload.data.filter((row) => row.status === 'error').length
  const selectedAuditId = resolveSelectedAuditId(
    resolvedSearchParams,
    payload.data.map((row) => row.id),
  )
  const selectedEntry =
    payload.data.find((row) => row.id === selectedAuditId) ?? payload.data[0] ?? null
  const selectedDetail = selectedEntry ? await loadAiAuditDetail(selectedEntry.id) : null
  const hasActiveFilters = Boolean(filters.toolId || filters.status !== 'all')
  const selectionFellBack = Boolean(
    requestedAuditId &&
      payload.data.length > 0 &&
      !payload.data.some((row) => row.id === requestedAuditId),
  )

  return (
    <PageContainer
      pageTitle="审计台账"
      pageDescription="工具级审计证据视图，包含状态筛选、压力信号与选中事件详情。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="ledger"
            detail="当前治理切片中可见的 AI 审计事件。"
            label="审计事件"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={forbiddenCount === 0 ? 'clear' : 'attention'}
            detail="被策略或权限边界阻止的行。"
            label="禁止"
            value={formatCount(forbiddenCount)}
            variant={forbiddenCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={overrideCount === 0 ? 'none' : 'human-loop'}
            detail="已关联人工接管的事件。"
            label="人工接管"
            value={formatCount(overrideCount)}
            variant={overrideCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={errorCount === 0 ? 'stable' : 'investigate'}
            detail="不属于简单权限拒绝的运行失败。"
            label="错误"
            value={formatCount(errorCount)}
            variant={errorCount === 0 ? 'outline' : 'destructive'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>筛选</CardDescription>
                <CardTitle>审计查询</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/govern/audit"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedEntry ? (
                    <input name="auditId" type="hidden" value={selectedEntry.id} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="toolId">工具 ID</FieldLabel>
                    <Input
                      defaultValue={filters.toolId}
                      id="toolId"
                      name="toolId"
                      placeholder="knowledge-semantic-search"
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
                      <option value="success">Success</option>
                      <option value="forbidden">Forbidden</option>
                      <option value="error">Error</option>
                    </select>
                  </Field>

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/govern/audit"
                    >
                      重置
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>审计表格</CardDescription>
                <CardTitle>工具执行台账</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>当前选择已回退到首个可见审计事件</AlertTitle>
                      <AlertDescription>
                        之前选中的审计行已经不在当前切片中，所以证据面板回退到了第一条可见记录。
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {payload.data.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/govern/audit', label: '重置审计查询' }}
                      description={
                        hasActiveFilters
                          ? '当前审计查询没有可见治理事件。先重置切片，再判断这个空结果是否符合预期。'
                          : '当前还没有可见治理审计记录。等待下一次事件，或确认工具级审计证据是否正在写入。'
                      }
                      title={hasActiveFilters ? '没有审计记录匹配当前查询' : '当前没有可见审计记录'}
                      tone={hasActiveFilters ? 'no-match' : 'no-data'}
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>工具</TableHead>
                            <TableHead>范围</TableHead>
                            <TableHead>主体</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>反馈</TableHead>
                            <TableHead>创建时间</TableHead>
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
                                <TableCell>
                                  <Link
                                    className={cn(
                                      'font-medium underline-offset-4 hover:underline',
                                      isSelected && 'text-foreground',
                                    )}
                                    href={
                                      createDashboardHref(
                                        '/dashboard/govern/audit',
                                        resolvedSearchParams,
                                        {
                                          auditId: row.id,
                                          page: undefined,
                                        },
                                      ) as Route
                                    }
                                  >
                                    {row.toolId}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.action}:{row.subject}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.actorRbacUserId ?? row.actorAuthUserId ?? '系统'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={resolveBadgeVariant(row.status)}>
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {row.feedbackCount} · {row.latestUserAction ?? '无动作'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDateTime(row.createdAt)}
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
                          ? createDashboardHref('/dashboard/govern/audit', resolvedSearchParams, {
                              page: String(payload.pagination.page + 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      page={payload.pagination.page}
                      pageSize={payload.pagination.pageSize}
                      previousHref={
                        payload.pagination.page > 1
                          ? createDashboardHref('/dashboard/govern/audit', resolvedSearchParams, {
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
              <CardDescription>选中证据</CardDescription>
              <CardTitle>{selectedEntry?.toolId ?? '选择一个审计事件'}</CardTitle>
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
                        <p>请求 ID: {selectedEntry.requestId ?? '无'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        证据 / 元数据
                      </p>
                      <div className="grid gap-2">
                        <p>反馈数: {selectedEntry.feedbackCount}</p>
                        <p>最新用户动作: {selectedEntry.latestUserAction ?? '无'}</p>
                        <p>最近反馈时间: {selectedEntry.latestFeedbackAt ?? '无'}</p>
                        <p>
                          请求 ID:{' '}
                          {selectedDetail?.requestInfo?.requestId ??
                            selectedEntry.requestId ??
                            '无'}
                        </p>
                        <p>来源类型: {selectedDetail?.requestInfo?.sourceType ?? '无'}</p>
                        <p>
                          操作主体:{' '}
                          {selectedEntry.actorRbacUserId ?? selectedEntry.actorAuthUserId ?? '系统'}
                        </p>
                        <p>
                          角色快照:{' '}
                          {selectedEntry.roleCodes.length > 0
                            ? selectedEntry.roleCodes.join(', ')
                            : '无'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        人工反馈 / 接管
                      </p>
                      <p className="text-muted-foreground mb-3 text-sm leading-6">
                        {selectedEntry.humanOverride
                          ? '这个事件已经跨过人工接管边界。升级到 Prompt 复核或运行时分诊之前，先查看反馈轨迹。'
                          : '当前还没有人工接管。使用这条轨迹判断它应继续留在审计复核，还是转入其他工作台。'}
                      </p>
                      {selectedDetail?.feedback.length ? (
                        <div className="grid gap-3">
                          {selectedDetail.feedback.map((feedback) => (
                            <div className="rounded-md border p-3" key={feedback.id}>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{feedback.userAction}</Badge>
                                <Badge variant="outline">
                                  {feedback.accepted ? '已接受' : '人工编辑'}
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
                        <p className="text-muted-foreground">当前还没有关联反馈记录。</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="选择一个审计事件，查看执行摘要、证据元数据和人工反馈态势。"
                  title="当前没有选中审计事件"
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
