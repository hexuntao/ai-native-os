import type { AiAuditListResponse } from '@ai-native-os/shared'
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

import { FilterSelect } from '@/components/management/filter-select'
import { AssistantHandoffCard, SurfaceStatePanel } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  type AiAuditFilterState,
  createDashboardHref,
  type DashboardSearchParams,
} from '@/lib/management'

interface RunsWorkbenchPageProps {
  filters: AiAuditFilterState
  payload: AiAuditListResponse
  resolvedSearchParams: DashboardSearchParams
  selectedAuditId: string | null
}

export function RunsWorkbenchPage({
  filters,
  payload,
  resolvedSearchParams,
  selectedAuditId,
}: RunsWorkbenchPageProps): ReactNode {
  const selectedEntry =
    payload.data.find((row) => row.id === selectedAuditId) ?? payload.data[0] ?? null
  const assistantHandoff = resolveCopilotPageHandoff('/observe/runs')
  const degradedCount = payload.data.filter(
    (row) => row.status === 'error' || row.status === 'forbidden',
  ).length

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
      description="Runs & Traces 工作台把审计事件重组为运行视角，帮助操作员从一张列表进入单条执行证据，而不是停留在治理摘要层。"
      eyebrow="Observe"
      signals={[
        {
          badge: 'runs',
          detail: '当前查询条件下命中的 AI 审计事件总数。',
          label: 'Visible runs',
          tone: payload.pagination.total > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.pagination.total),
        },
        {
          badge: degradedCount === 0 ? 'clear' : 'triage',
          detail: '当前页切片里需要排查的错误或拒绝运行数量。',
          label: 'Needs triage',
          tone: degradedCount === 0 ? 'positive' : 'warning',
          value: formatCount(degradedCount),
        },
        {
          badge: 'override',
          detail: '当前切片中已经进入 human-in-the-loop 的运行数量。',
          label: 'Overrides',
          tone: payload.data.some((row) => row.humanOverride) ? 'warning' : 'neutral',
          value: formatCount(payload.data.filter((row) => row.humanOverride).length),
        },
        {
          badge: 'feedback',
          detail: '当前切片关联的人类反馈记录数量。',
          label: 'Feedback links',
          tone: payload.data.some((row) => row.feedbackCount > 0) ? 'positive' : 'neutral',
          value: formatCount(payload.data.reduce((total, row) => total + row.feedbackCount, 0)),
        },
      ]}
      title="Runs & Traces"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
        <div className="grid gap-4">
          <form
            action="/observe/runs"
            aria-label="Runs filters"
            className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
            method="GET"
          >
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
            {selectedEntry ? <input name="auditId" type="hidden" value={selectedEntry.id} /> : null}

            <Field>
              <FieldLabel htmlFor="search">Trace search</FieldLabel>
              <Input
                defaultValue={filters.search}
                id="search"
                name="search"
                placeholder="request id or tool"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <FilterSelect defaultValue={filters.status} id="status" name="status">
                <option value="all">All statuses</option>
                <option value="success">Success</option>
                <option value="forbidden">Forbidden</option>
                <option value="error">Error</option>
              </FilterSelect>
            </Field>

            <div className="flex items-end gap-3">
              <a
                className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
                href="/observe/runs"
              >
                Reset
              </a>
            </div>
          </form>

          <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Run table
              </p>
              <CardTitle className="text-xl">Operator-visible execution slice</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              {payload.data.length === 0 ? (
                <div className="p-6">
                  <SurfaceStatePanel
                    actionHref="/observe/runs"
                    actionLabel="Reset filters"
                    description="当前筛选条件下没有命中的运行事件。先放宽搜索条件，再决定是否进入具体证据追踪。"
                    eyebrow="Runs empty state"
                    title="No runs in this slice"
                    tone="neutral"
                  />
                </div>
              ) : (
                <div className="grid gap-4 p-4">
                  <ResponsiveTableRegion label="Runs table" minWidthClassName="min-w-[62rem]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Tool</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Feedback</TableHead>
                          <TableHead>Request</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payload.data.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              <a
                                className="underline-offset-4 hover:underline"
                                href={createDashboardHref('/observe/runs', resolvedSearchParams, {
                                  auditId: row.id,
                                  page: undefined,
                                })}
                              >
                                {formatDateTime(row.createdAt)}
                              </a>
                            </TableCell>
                            <TableCell className="font-medium">{row.toolId}</TableCell>
                            <TableCell>
                              {row.action}:{row.subject}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.status === 'success' ? 'secondary' : 'accent'}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.feedbackCount}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.requestId ?? 'no request id'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableRegion>

                  <PaginationControls
                    nextHref={
                      payload.pagination.page < payload.pagination.totalPages
                        ? createDashboardHref('/observe/runs', resolvedSearchParams, {
                            page: String(payload.pagination.page + 1),
                            auditId: selectedEntry?.id ?? undefined,
                          })
                        : undefined
                    }
                    page={payload.pagination.page}
                    pageSize={payload.pagination.pageSize}
                    previousHref={
                      payload.pagination.page > 1
                        ? createDashboardHref('/observe/runs', resolvedSearchParams, {
                            page: String(payload.pagination.page - 1),
                            auditId: selectedEntry?.id ?? undefined,
                          })
                        : undefined
                    }
                    total={payload.pagination.total}
                    totalPages={payload.pagination.totalPages}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/75 bg-background/84 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Trace inspector
            </p>
            <CardTitle className="text-xl">
              {selectedEntry ? selectedEntry.toolId : 'Select a run'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-5">
            {selectedEntry ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedEntry.status === 'success' ? 'secondary' : 'accent'}>
                    {selectedEntry.status}
                  </Badge>
                  <Badge variant="secondary">
                    {selectedEntry.action}:{selectedEntry.subject}
                  </Badge>
                  <Badge variant="secondary">
                    override:{selectedEntry.humanOverride ? 'yes' : 'no'}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Step timeline
                    </p>
                    <div className="mt-3 grid gap-2">
                      <p>1. Request captured at {formatDateTime(selectedEntry.createdAt)}</p>
                      <p>
                        2. Tool `{selectedEntry.toolId}` resolved for action `{selectedEntry.action}
                        `
                      </p>
                      <p>
                        3. Subject `{selectedEntry.subject}` evaluated under current permission
                        boundary
                      </p>
                      <p>4. Runtime finished with status `{selectedEntry.status}`</p>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Metadata
                    </p>
                    <div className="mt-3 grid gap-2">
                      <p>requestId: {selectedEntry.requestId ?? 'none'}</p>
                      <p>feedbackCount: {selectedEntry.feedbackCount}</p>
                      <p>
                        override:{' '}
                        {selectedEntry.humanOverride ? 'human-in-the-loop' : 'no override'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <SurfaceStatePanel
                description="先从左侧运行表选择一条记录，再在这里检查它的状态、时间线和上下文信息。"
                eyebrow="Trace inspector"
                title="No run selected"
                tone="neutral"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </StatusWorkbenchPage>
  )
}
