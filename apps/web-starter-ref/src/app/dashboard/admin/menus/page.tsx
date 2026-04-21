import Link from 'next/link'
import type { ReactNode } from 'react'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
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
import { canManageMenus } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createMenuFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadMenusList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface AdminMenusPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Navigation Registry',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect routed menu definitions, permission bindings, and visibility state from the authenticated navigation contract.',
      },
    ],
  }
}

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function AdminMenusPage({
  searchParams,
}: AdminMenusPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createMenuFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadMenusList(filters),
    loadSerializedAbilityPayload(),
  ])
  const canWriteMenus = abilityPayload ? canManageMenus(abilityPayload) : false

  return (
    <PageContainer
      pageTitle="Navigation Registry"
      pageDescription="Menu topology with path, permission, visibility, and status state."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="menus"
            detail="Total menu nodes exposed by the system contract."
            label="Menu records"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="visible"
            detail="Entries in this page slice that are visible in navigation contexts."
            label="Visible items"
            value={formatCount(payload.data.filter((row) => row.visible).length)}
          />
          <MetricCard
            badge="protected"
            detail="Entries currently bound to explicit permission metadata."
            label="Protected routes"
            value={formatCount(
              payload.data.filter((row) => row.permissionAction && row.permissionResource).length,
            )}
          />
          <MetricCard
            badge={canWriteMenus ? 'write-enabled' : 'read-only'}
            detail="Whether the current operator can mutate menu records."
            label="Mutation mode"
            value={canWriteMenus ? 'write' : 'read'}
            variant={canWriteMenus ? 'secondary' : 'outline'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Filters</CardDescription>
            <CardTitle>Navigation slice</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action="/dashboard/admin/menus"
              className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                  placeholder="Search menu name or path"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select
                  className={selectClassName}
                  defaultValue={filters.status}
                  id="status"
                  name="status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </Field>

              <Field>
                <FieldLabel htmlFor="visible">Visibility</FieldLabel>
                <select
                  className={selectClassName}
                  defaultValue={filters.visible}
                  id="visible"
                  name="visible"
                >
                  <option value="all">All visibility</option>
                  <option value="visible">Visible only</option>
                  <option value="hidden">Hidden only</option>
                </select>
              </Field>

              <div className="flex items-end gap-3">
                <Link
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                  href="/dashboard/admin/menus"
                >
                  Reset
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Navigation table</CardDescription>
            <CardTitle>Menu registry</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.path ?? 'no-path'}
                      </TableCell>
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
                          <Badge variant={row.visible ? 'secondary' : 'outline'}>
                            {row.visible ? 'visible' : 'hidden'}
                          </Badge>
                          <Badge variant={row.status ? 'outline' : 'secondary'}>
                            {row.status ? 'active' : 'inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PagePagination
              nextHref={
                payload.pagination.page < payload.pagination.totalPages
                  ? createDashboardHref('/dashboard/admin/menus', resolvedSearchParams, {
                      page: String(payload.pagination.page + 1),
                    })
                  : undefined
              }
              page={payload.pagination.page}
              pageSize={payload.pagination.pageSize}
              previousHref={
                payload.pagination.page > 1
                  ? createDashboardHref('/dashboard/admin/menus', resolvedSearchParams, {
                      page: String(payload.pagination.page - 1),
                    })
                  : undefined
              }
              total={payload.pagination.total}
              totalPages={payload.pagination.totalPages}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
