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

import { AiFeedbackDialog } from '@/components/ai/ai-feedback-dialog'
import { FilterSelect } from '@/components/management/filter-select'
import { AssistantHandoffCard, SurfaceStatePanel } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createAiAuditFilterState,
  createDashboardHref,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiAuditLogsList } from '@/lib/server-management'

interface AiAuditPageProps {
  searchParams: Promise<DashboardSearchParams>
}

/**
 * 将审计行状态压缩为当前页切片的治理摘要，供右侧工作台快速阅读。
 */
function summarizeAuditStatuses(
  statuses: readonly string[],
): Array<{ label: string; value: number }> {
  return [
    {
      label: 'success',
      value: statuses.filter((status) => status === 'success').length,
    },
    {
      label: 'forbidden',
      value: statuses.filter((status) => status === 'forbidden').length,
    },
    {
      label: 'error',
      value: statuses.filter((status) => status === 'error').length,
    },
  ]
}

export default async function AiAuditPage({ searchParams }: AiAuditPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const forbiddenCount = payload.data.filter((row) => row.status === 'forbidden').length
  const overrideCount = payload.data.filter((row) => row.humanOverride).length
  const errorCount = payload.data.filter((row) => row.status === 'error').length
  const auditStatusSummary = summarizeAuditStatuses(payload.data.map((row) => row.status))
  const assistantHandoff = resolveCopilotPageHandoff('/ai/audit')

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
          label: 'Tool filter',
          value: filters.toolId ?? 'All tools',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
      ]}
      description="AI 治理页优先暴露工具审计压力、人工覆盖和失败密度，而不是把治理判断埋在表格最后一列。"
      eyebrow="AI Module"
      signals={[
        {
          badge: 'ledger',
          detail: '当前查询条件下命中的 AI 工具审计总事件数。',
          label: 'Audit events',
          tone: payload.pagination.total > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.pagination.total),
        },
        {
          badge: forbiddenCount === 0 ? 'clear' : 'attention',
          detail: '当前页切片里因为权限或安全策略被拒绝的工具调用数。',
          label: 'Forbidden',
          tone: forbiddenCount === 0 ? 'positive' : 'warning',
          value: formatCount(forbiddenCount),
        },
        {
          badge: overrideCount > 0 ? 'human-in-loop' : 'none',
          detail: '已经出现人工覆盖或反馈接管的审计事件数量。',
          label: 'Overrides',
          tone: overrideCount > 0 ? 'warning' : 'neutral',
          value: formatCount(overrideCount),
        },
        {
          badge: errorCount === 0 ? 'stable' : 'investigate',
          detail: '工具执行错误说明模型或工具链路出现非权限型失败。',
          label: 'Errors',
          tone: errorCount === 0 ? 'positive' : 'critical',
          value: formatCount(errorCount),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Governance strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">tool:{filters.toolId ?? 'all'}</Badge>
              <Badge variant={filters.status === 'all' ? 'secondary' : 'accent'}>
                status:{filters.status}
              </Badge>
              <Badge variant={overrideCount > 0 ? 'accent' : 'secondary'}>
                overrides:{overrideCount}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Audit boundary</p>
            <p className="text-sm leading-6 text-muted-foreground">
              当前页面覆盖 tool-level audit、人工反馈和 human override，但还不是完整审批流控制台。
            </p>
          </div>
        </div>
      }
      title="AI Audit Ledger"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <div className="grid gap-4">
          <form
            action="/ai/audit"
            aria-label="AI audit filters"
            className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
            method="GET"
          >
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

            <Field>
              <FieldLabel htmlFor="toolId">Tool ID</FieldLabel>
              <Input
                defaultValue={filters.toolId}
                id="toolId"
                name="toolId"
                placeholder="knowledge-semantic-search"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <FilterSelect defaultValue={filters.status} id="status" name="status">
                <option value="all">All statuses</option>
                <option value="success">Success only</option>
                <option value="forbidden">Forbidden only</option>
                <option value="error">Error only</option>
              </FilterSelect>
            </Field>

            <div className="flex items-end gap-3">
              <a
                className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
                href="/ai/audit"
              >
                Reset
              </a>
            </div>
          </form>

          <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Audit table
              </p>
              <CardTitle className="text-xl">Tool execution ledger</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              {payload.data.length === 0 ? (
                <div className="p-6">
                  <SurfaceStatePanel
                    actionHref="/ai/audit"
                    actionLabel="Reset filters"
                    description="当前筛选条件下没有 AI 审计事件。先确认 toolId 和 status 条件，再判断这是健康空窗还是观测缺口。"
                    eyebrow="Audit empty state"
                    hints={[
                      '空切片不代表系统没有风险，只代表当前过滤器下没有可见审计证据。',
                      '如果你在追查越权或异常执行，先放宽 status，再让助手做边界解读。',
                    ]}
                    title="No AI audit rows in this slice"
                    tone="neutral"
                  />
                </div>
              ) : (
                <ResponsiveTableRegion
                  label="AI audit ledger table"
                  minWidthClassName="min-w-[62rem]"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tool</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Feedback</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="grid gap-1">
                              <span className="font-medium">{row.toolId}</span>
                              <span className="text-sm text-muted-foreground">
                                {row.requestId ?? 'no request id'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.action}:{row.subject}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.actorRbacUserId ?? row.actorAuthUserId ?? 'system'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.status === 'success' ? 'accent' : 'secondary'}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AiFeedbackDialog
                              auditLogId={row.id}
                              feedbackCount={row.feedbackCount}
                              humanOverride={row.humanOverride}
                              latestUserAction={row.latestUserAction}
                              toolId={row.toolId}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(row.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableRegion>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Slice status
              </p>
              <CardTitle className="text-xl">Current query distribution</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {auditStatusSummary.map((entry) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2 text-sm"
                  key={entry.label}
                >
                  <span className="text-muted-foreground">{entry.label}</span>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Governance read
              </p>
              <CardTitle className="text-xl">What this page means</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <p>Forbidden 上升通常表示 tool permission 或上下文桥接发生变化。</p>
              <p>Override 上升说明模型结果还不稳定，但当前团队仍在用人工兜底维持链路。</p>
              <p>Error 上升更值得优先排查，因为它通常不是权限问题，而是执行问题。</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/ai/audit', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/ai/audit', resolvedSearchParams, {
                page: String(payload.pagination.page - 1),
              })
            : undefined
        }
        total={payload.pagination.total}
        totalPages={payload.pagination.totalPages}
      />
    </StatusWorkbenchPage>
  )
}
