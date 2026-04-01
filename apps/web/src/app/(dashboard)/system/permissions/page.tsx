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
import { PaginationControls } from '@/components/management/pagination-controls'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createPermissionFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadPermissionsList } from '@/lib/server-management'

interface PermissionsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function SystemPermissionsPage({
  searchParams,
}: PermissionsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createPermissionFilterState(resolvedSearchParams)
  const payload = await loadPermissionsList(filters)

  return (
    <DataSurfacePage
      description="Permission topology rendered directly from the documented contract-first API. This view exposes action-resource pairs, inversion, field scopes, and condition coverage without enabling writes."
      eyebrow="System Module"
      facts={[
        {
          label: 'Resource filter',
          value: filters.resource ?? 'All resources',
        },
        {
          label: 'Action filter',
          value: filters.action ?? 'All actions',
        },
      ]}
      metrics={[
        {
          detail: 'Total permission records currently registered.',
          label: 'Permission rows',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Records in the current page slice with field-level scoping.',
          label: 'Field scoped',
          value: formatCount(payload.data.filter((row) => (row.fields?.length ?? 0) > 0).length),
        },
        {
          detail: 'Records with conditional CASL constraints.',
          label: 'Conditional',
          value: formatCount(
            payload.data.filter((row) => row.conditions && Object.keys(row.conditions).length > 0)
              .length,
          ),
        },
      ]}
      title="Permission Center"
    >
      <form
        action="/system/permissions"
        className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
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
            placeholder="Search resource or action"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="resource">Resource</FieldLabel>
          <Input
            defaultValue={filters.resource}
            id="resource"
            name="resource"
            placeholder="User / Role / Menu"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="action">Action</FieldLabel>
          <Input
            defaultValue={filters.action}
            id="action"
            name="action"
            placeholder="read / manage"
          />
        </Field>

        <div className="flex items-end gap-3">
          <Badge variant="secondary">super-admin view</Badge>
        </div>
      </form>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Field scope</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">
                        {row.action}:{row.resource}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {row.description ?? 'No description'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.inverted ? 'secondary' : 'accent'}>
                      {row.inverted ? 'deny' : 'allow'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.fields?.length ? row.fields.join(', ') : 'all fields'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.conditions ? JSON.stringify(row.conditions) : 'none'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4">
          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Policy boundary</FieldLabel>
            <FieldHint>
              This page reflects persisted policy state. Effective access still depends on runtime
              CASL evaluation.
            </FieldHint>
          </Field>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Mutation status
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                Editing remains intentionally disabled because write contracts, approvals, and audit
                rollback are not complete.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/permissions', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/permissions', resolvedSearchParams, {
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
