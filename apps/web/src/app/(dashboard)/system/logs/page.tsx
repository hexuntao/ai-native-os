import {
  Badge,
  Field,
  FieldHint,
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

import { DataSurfacePage } from '@/components/management/data-surface-page'
import { FilterSelect } from '@/components/management/filter-select'
import { AssistantHandoffCard, SurfaceStatePanel } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createLogFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadOperationLogsList } from '@/lib/server-management'

interface LogsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function SystemLogsPage({ searchParams }: LogsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createLogFilterState(resolvedSearchParams)
  const payload = await loadOperationLogsList(filters)
  const assistantHandoff = resolveCopilotPageHandoff('/system/logs')

  return (
    <DataSurfacePage
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
      description="Operational audit stream rendered from the monitor contract. This page is read-only and focuses on traceability, not incident remediation."
      eyebrow="Monitor Module"
      facts={[
        {
          label: 'Module filter',
          value: filters.module ?? 'All modules',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
      ]}
      metrics={[
        {
          detail: 'Total operation log entries returned by the monitor API.',
          label: 'Audit rows',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Failures visible in the current page slice.',
          label: 'Failures',
          value: formatCount(payload.data.filter((row) => row.status === 'error').length),
        },
        {
          detail: 'Distinct modules represented in the current page slice.',
          label: 'Modules',
          value: formatCount(new Set(payload.data.map((row) => row.module)).size),
        },
      ]}
      title="Audit Trails"
    >
      <form
        action="/system/logs"
        aria-label="Audit log filters"
        className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        method="GET"
      >
        <input name="page" type="hidden" value="1" />
        <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

        <Field>
          <FieldLabel htmlFor="search">Search</FieldLabel>
          <Input
            defaultValue={filters.search}
            id="search"
            name="search"
            placeholder="Search detail text"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="module">Module</FieldLabel>
          <Input
            defaultValue={filters.module}
            id="module"
            name="module"
            placeholder="system / ai / jobs"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <FilterSelect defaultValue={filters.status} id="status" name="status">
            <option value="all">All statuses</option>
            <option value="success">Success only</option>
            <option value="error">Error only</option>
          </FilterSelect>
        </Field>

        <div className="flex items-end gap-3">
          <a
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
            href="/system/logs"
          >
            Reset
          </a>
        </div>
      </form>

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
        {payload.data.length === 0 ? (
          <div className="p-6">
            <SurfaceStatePanel
              actionHref="/system/logs"
              actionLabel="Reset filters"
              description="当前筛选条件下没有命中任何审计行。先放宽 module、status 或 search，再决定是否把问题交给助手做 slice 解读。"
              eyebrow="Logs empty state"
              hints={[
                '如果你在追查 incident，先确认 module 过滤没有把真正的信号挡掉。',
                '如果这是全新环境，空日志并不一定是异常，也可能只是还没有操作事件进入审计流。',
              ]}
              title="No audit rows in this slice"
              tone="neutral"
            />
          </div>
        ) : (
          <ResponsiveTableRegion label="System audit logs table" minWidthClassName="min-w-[52rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.module}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'success' ? 'accent' : 'secondary'}>
                        {row.status}
                      </Badge>
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
      </div>

      <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
        <FieldLabel>Trace coverage</FieldLabel>
        <FieldHint>
          Trace-level drill-down remains a Phase 5 concern. This view intentionally stops at audit
          row visibility.
        </FieldHint>
      </Field>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/logs', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/logs', resolvedSearchParams, {
                page: String(payload.pagination.page - 1),
              })
            : undefined
        }
        total={payload.pagination.total}
        totalPages={payload.pagination.totalPages}
      />
    </DataSurfacePage>
  )
}
