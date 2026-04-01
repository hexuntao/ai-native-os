import {
  Badge,
  Field,
  FieldHint,
  FieldLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { DataSurfacePage } from '@/components/management/data-surface-page'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { PaginationControls } from '@/components/management/pagination-controls'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadOnlineUsersList } from '@/lib/server-management'

interface OnlinePageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function MonitorOnlinePage({
  searchParams,
}: OnlinePageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadOnlineUsersList(filters)

  return (
    <DataSurfacePage
      description="Authenticated session monitor built from Better Auth sessions with RBAC role reconciliation. This is an approximate online-presence view by design."
      eyebrow="Monitor Module"
      facts={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All active sessions',
        },
        {
          label: 'Presence source',
          value: 'Better Auth sessions',
        },
      ]}
      metrics={[
        {
          detail: 'Total active sessions returned by the presence approximation.',
          label: 'Active sessions',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Distinct RBAC-linked users represented in the current page slice.',
          label: 'Mapped users',
          value: formatCount(
            new Set(payload.data.map((row) => row.rbacUserId).filter(Boolean)).size,
          ),
        },
        {
          detail: 'Sessions carrying an attached user agent string.',
          label: 'Device traces',
          value: formatCount(payload.data.filter((row) => Boolean(row.userAgent)).length),
        },
      ]}
      title="Live Sessions"
    >
      <FilterToolbar
        actionHref="/monitor/online"
        pageSize={filters.pageSize}
        resetHref="/monitor/online"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search email or display name"
      />

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operator</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Session</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payload.data.map((row) => (
              <TableRow key={row.sessionId}>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-sm text-muted-foreground">{row.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {row.roleCodes.length === 0 ? (
                      <Badge variant="secondary">unmapped</Badge>
                    ) : (
                      row.roleCodes.map((roleCode) => (
                        <Badge key={roleCode} variant="outline">
                          {roleCode}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.ipAddress ?? 'unknown'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.expiresAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.sessionId.slice(0, 8)}…
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
        <FieldLabel>Approximation boundary</FieldLabel>
        <FieldHint>
          This page does not use heartbeat telemetry yet. Presence is inferred from non-expired auth
          sessions only.
        </FieldHint>
      </Field>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/monitor/online', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/monitor/online', resolvedSearchParams, {
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
