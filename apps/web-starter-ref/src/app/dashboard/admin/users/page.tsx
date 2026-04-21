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
import { canManageUserDirectory } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import {
  loadAssignableRoles,
  loadSerializedAbilityPayload,
  loadUsersList,
} from '@/lib/server-management'

interface AdminUsersPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Users Directory',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect authenticated principals, role bindings, and current directory posture from the system contract.',
      },
    ],
  }
}

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const [payload, assignableRoles, abilityPayload] = await Promise.all([
    loadUsersList(filters),
    loadAssignableRoles(),
    loadSerializedAbilityPayload(),
  ])
  const canWriteUsers = abilityPayload ? canManageUserDirectory(abilityPayload) : false

  return (
    <PageContainer
      pageTitle="Users Directory"
      pageDescription="Authenticated principals, role bindings, and directory status in a starter-based admin surface."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="directory"
            detail="Total principals returned by the system contract."
            label="Directory size"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="visible"
            detail="Rows visible in the current page slice."
            label="Visible rows"
            value={formatCount(payload.data.length)}
          />
          <MetricCard
            badge="roles"
            detail="Assignable active roles available to the user workflow."
            label="Assignable roles"
            value={formatCount(assignableRoles.length)}
          />
          <MetricCard
            badge={canWriteUsers ? 'write-enabled' : 'read-only'}
            detail="Whether the current operator can mutate directory records."
            label="Mutation mode"
            value={canWriteUsers ? 'write' : 'read'}
            variant={canWriteUsers ? 'secondary' : 'outline'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Filters</CardDescription>
            <CardTitle>User directory slice</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action="/dashboard/admin/users"
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
                  placeholder="Search username or email"
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
                  href="/dashboard/admin/users"
                >
                  Reset
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Directory table</CardDescription>
            <CardTitle>Authenticated principals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
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
                          <span className="text-muted-foreground text-xs">
                            {row.nickname ?? 'No nickname'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.roleCodes.length === 0 ? (
                            <Badge variant="outline">unassigned</Badge>
                          ) : (
                            row.roleCodes.map((roleCode: string) => (
                              <Badge key={roleCode} variant="outline">
                                {roleCode}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
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
                  ? createDashboardHref('/dashboard/admin/users', resolvedSearchParams, {
                      page: String(payload.pagination.page + 1),
                    })
                  : undefined
              }
              page={payload.pagination.page}
              pageSize={payload.pagination.pageSize}
              previousHref={
                payload.pagination.page > 1
                  ? createDashboardHref('/dashboard/admin/users', resolvedSearchParams, {
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
