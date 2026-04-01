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
import { formatCount } from '@/lib/format'
import {
  createDashboardHref,
  createMenuFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadMenusList } from '@/lib/server-management'

interface MenusPageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function SystemMenusPage({
  searchParams,
}: MenusPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createMenuFilterState(resolvedSearchParams)
  const payload = await loadMenusList(filters)

  return (
    <DataSurfacePage
      description="Navigation registry driven by contract-first menu resources. This page makes permission bindings and route inventory visible before mutation flows are added."
      eyebrow="System Module"
      facts={[
        {
          label: 'Visibility filter',
          value: filters.visible,
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
      ]}
      metrics={[
        {
          detail: 'Total menu records exposed by the documented system contract.',
          label: 'Menu records',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Entries in the current page slice that are visible in navigation contexts.',
          label: 'Visible items',
          value: formatCount(payload.data.filter((row) => row.visible).length),
        },
        {
          detail: 'Entries with an attached permission binding.',
          label: 'Protected routes',
          value: formatCount(
            payload.data.filter((row) => row.permissionAction && row.permissionResource).length,
          ),
        },
      ]}
      title="Navigation Registry"
    >
      <FilterToolbar
        actionHref="/system/menus"
        pageSize={filters.pageSize}
        resetHref="/system/menus"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search menu name"
      >
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <FilterSelect defaultValue={filters.status} id="status" name="status">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </FilterSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="visible">Visibility</FieldLabel>
          <FilterSelect defaultValue={filters.visible} id="visible" name="visible">
            <option value="all">All visibility</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </FilterSelect>
        </Field>
      </FilterToolbar>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-sm text-muted-foreground">sort #{row.sortOrder}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.path ?? 'no-path'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.permissionAction && row.permissionResource
                      ? `${row.permissionAction}:${row.permissionResource}`
                      : 'public shell'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.visible ? 'accent' : 'secondary'}>
                        {row.visible ? 'visible' : 'hidden'}
                      </Badge>
                      <Badge variant={row.status ? 'outline' : 'secondary'}>
                        {row.status ? 'active' : 'inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4">
          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Route shape</FieldLabel>
            <FieldHint>
              Menu nodes can exist without direct paths when they serve as parent shells or section
              headers.
            </FieldHint>
          </Field>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Binding notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                Permission bindings here are declarative metadata and do not replace the API-side
                CASL checks.
              </p>
              <p>Hidden routes may still exist for deep links or admin-only flows.</p>
            </div>
          </div>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/menus', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/menus', resolvedSearchParams, {
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
