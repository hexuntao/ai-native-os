import {
  Badge,
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
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { FilterSelect } from '@/components/management/filter-select'
import { PaginationControls } from '@/components/management/pagination-controls'
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

export default async function AiAuditPage({ searchParams }: AiAuditPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)

  return (
    <DataSurfacePage
      description="AI tool audit ledger rendered from the documented AI contract. This surface focuses on actor, tool, and outcome visibility without exposing raw prompt payloads."
      eyebrow="AI Module"
      facts={[
        {
          label: 'Tool filter',
          value: filters.toolId ?? 'All tools',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
      ]}
      metrics={[
        {
          detail: 'Total AI audit events returned by the ledger contract.',
          label: 'Audit events',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Forbidden tool calls visible in the current slice.',
          label: 'Forbidden',
          value: formatCount(payload.data.filter((row) => row.status === 'forbidden').length),
        },
        {
          detail: 'Audit rows that already carry a recorded human override.',
          label: 'Overrides',
          value: formatCount(payload.data.filter((row) => row.humanOverride).length),
        },
      ]}
      title="AI Audit Ledger"
    >
      <form
        action="/ai/audit"
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

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
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
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
        <p className="text-sm font-medium text-foreground">Audit boundary</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Agent reasoning, prompt versions, and HITL approvals are not yet represented here. This
          page now captures operator feedback and human overrides on top of the existing tool-level
          audit chain, but it is not a full approval workflow surface yet.
        </p>
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
    </DataSurfacePage>
  )
}
