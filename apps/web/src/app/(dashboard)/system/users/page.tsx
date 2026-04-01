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
import { FilterSelect } from '@/components/management/filter-select'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { PaginationControls } from '@/components/management/pagination-controls'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadUsersList } from '@/lib/server-management'

interface UsersPageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function SystemUsersPage({
  searchParams,
}: UsersPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const payload = await loadUsersList(filters)

  return (
    <DataSurfacePage
      description="Contract-first operator directory backed by the authenticated system API. This surface stays read-only until write contracts and audit-safe mutations are implemented."
      eyebrow="System Module"
      facts={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All usernames',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
      ]}
      metrics={[
        {
          detail: 'Total application principals currently mapped into the RBAC layer.',
          label: 'Directory size',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Rows returned in the current contract-first page window.',
          label: 'Visible rows',
          value: formatCount(payload.data.length),
        },
        {
          detail: 'Distinct role bindings represented across the current page slice.',
          label: 'Mapped roles',
          value: formatCount(new Set(payload.data.flatMap((row) => row.roleCodes)).size),
        },
      ]}
      title="Users Directory"
    >
      <FilterToolbar
        actionHref="/system/users"
        pageSize={filters.pageSize}
        resetHref="/system/users"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search username"
      >
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <FilterSelect defaultValue={filters.status} id="status" name="status">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </FilterSelect>
        </Field>
      </FilterToolbar>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{row.username}</span>
                      <span className="text-sm text-muted-foreground">
                        {row.nickname ?? 'No nickname'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {row.roleCodes.length === 0 ? (
                        <Badge variant="secondary">unassigned</Badge>
                      ) : (
                        row.roleCodes.map((roleCode) => (
                          <Badge key={roleCode} variant="outline">
                            {roleCode}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status ? 'accent' : 'secondary'}>
                      {row.status ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Operator notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                RBAC mappings shown here are derived from the application user table, not Better
                Auth user IDs directly.
              </p>
              <p>
                Read access does not imply mutation capability. Write flows remain intentionally
                unavailable in this phase.
              </p>
            </div>
          </div>

          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Page slice</FieldLabel>
            <FieldHint>
              Reviewing page {payload.pagination.page} of{' '}
              {Math.max(payload.pagination.totalPages, 1)} with {payload.pagination.pageSize} rows
              per request.
            </FieldHint>
          </Field>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/users', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/users', resolvedSearchParams, {
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
