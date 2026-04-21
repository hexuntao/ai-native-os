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
import { canManageRoles } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import {
  loadAssignablePermissions,
  loadRolesList,
  loadSerializedAbilityPayload,
} from '@/lib/server-management'

interface AdminRolesPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Roles Matrix',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect seeded and custom RBAC roles, user assignment pressure, and permission topology from the authenticated system contract.',
      },
    ],
  }
}

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function AdminRolesPage({
  searchParams,
}: AdminRolesPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const [payload, assignablePermissions, abilityPayload] = await Promise.all([
    loadRolesList(filters),
    loadAssignablePermissions(),
    loadSerializedAbilityPayload(),
  ])
  const canWriteRoles = abilityPayload ? canManageRoles(abilityPayload) : false

  return (
    <PageContainer
      pageTitle="Roles Matrix"
      pageDescription="RBAC role registry with assignment counts, permission breadth, and status filters."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="roles"
            detail="Total roles returned by the system contract."
            label="Roles"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="assignments"
            detail="Combined user assignments in the current page slice."
            label="Assignments"
            value={formatCount(payload.data.reduce((sum, row) => sum + row.userCount, 0))}
          />
          <MetricCard
            badge="permissions"
            detail="Assignable permission rules exposed to the role editor."
            label="Permissions"
            value={formatCount(assignablePermissions.length)}
          />
          <MetricCard
            badge={canWriteRoles ? 'write-enabled' : 'read-only'}
            detail="Whether the current operator can mutate roles."
            label="Mutation mode"
            value={canWriteRoles ? 'write' : 'read'}
            variant={canWriteRoles ? 'secondary' : 'outline'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Filters</CardDescription>
            <CardTitle>Role registry slice</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action="/dashboard/admin/roles"
              className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
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
                  placeholder="Search role name"
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

              <div className="flex items-end gap-3">
                <Link
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                  href="/dashboard/admin/roles"
                >
                  Reset
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Role matrix</CardDescription>
            <CardTitle>RBAC registry</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{row.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.description ?? 'No description'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.code}</Badge>
                      </TableCell>
                      <TableCell>{formatCount(row.userCount)}</TableCell>
                      <TableCell>{formatCount(row.permissionCount)}</TableCell>
                      <TableCell>
                        <Badge variant={row.status ? 'secondary' : 'outline'}>
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
            <PagePagination
              nextHref={
                payload.pagination.page < payload.pagination.totalPages
                  ? createDashboardHref('/dashboard/admin/roles', resolvedSearchParams, {
                      page: String(payload.pagination.page + 1),
                    })
                  : undefined
              }
              page={payload.pagination.page}
              pageSize={payload.pagination.pageSize}
              previousHref={
                payload.pagination.page > 1
                  ? createDashboardHref('/dashboard/admin/roles', resolvedSearchParams, {
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
