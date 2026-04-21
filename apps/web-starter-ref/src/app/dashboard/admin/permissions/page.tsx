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
import { canManagePermissions } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createPermissionFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadPermissionsList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface AdminPermissionsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Permission Center',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect resource-action topology, field scoping, role linkage, and allow/deny mode without leaving the starter-based admin shell.',
      },
    ],
  }
}

export default async function AdminPermissionsPage({
  searchParams,
}: AdminPermissionsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createPermissionFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadPermissionsList(filters),
    loadSerializedAbilityPayload(),
  ])
  const canWritePermissions = abilityPayload ? canManagePermissions(abilityPayload) : false

  return (
    <PageContainer
      pageTitle="Permission Center"
      pageDescription="Permission topology with filters for resource, action, field scope, and role linkage."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="rules"
            detail="Total permission records currently registered."
            label="Permission rows"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="field-scope"
            detail="Rows in the current slice with field-level scope."
            label="Field scoped"
            value={formatCount(payload.data.filter((row) => (row.fields?.length ?? 0) > 0).length)}
          />
          <MetricCard
            badge="role-link"
            detail="Rows currently linked to at least one role."
            label="Role linked"
            value={formatCount(payload.data.filter((row) => row.roleCount > 0).length)}
          />
          <MetricCard
            badge={canWritePermissions ? 'write-enabled' : 'read-only'}
            detail="Whether the current operator can mutate permission records."
            label="Mutation mode"
            value={canWritePermissions ? 'write' : 'read'}
            variant={canWritePermissions ? 'secondary' : 'outline'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Filters</CardDescription>
            <CardTitle>Permission slice</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action="/dashboard/admin/permissions"
              className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                <Link
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                  href="/dashboard/admin/permissions"
                >
                  Reset
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Permission table</CardDescription>
            <CardTitle>Resource-action topology</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Field scope</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Roles</TableHead>
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
                          <span className="text-muted-foreground text-xs">
                            {row.description ?? 'No description'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.inverted ? 'outline' : 'secondary'}>
                          {row.inverted ? 'deny' : 'allow'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.fields?.length ? row.fields.join(', ') : 'all fields'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.conditions ? JSON.stringify(row.conditions) : 'none'}
                      </TableCell>
                      <TableCell>{formatCount(row.roleCount)}</TableCell>
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
                  ? createDashboardHref('/dashboard/admin/permissions', resolvedSearchParams, {
                      page: String(payload.pagination.page + 1),
                    })
                  : undefined
              }
              page={payload.pagination.page}
              pageSize={payload.pagination.pageSize}
              previousHref={
                payload.pagination.page > 1
                  ? createDashboardHref('/dashboard/admin/permissions', resolvedSearchParams, {
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
