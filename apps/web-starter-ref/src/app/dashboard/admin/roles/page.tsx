import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from '@/app/dashboard/admin/roles/actions'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PageFlashBanner } from '@/components/control-plane/page-flash-banner'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
import { DestructiveActionDialog } from '@/components/management/destructive-action-dialog'
import { ManagementDialog } from '@/components/management/management-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
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
import { canManageRoles, canReadPermissions } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
  readDashboardFlashMessage,
  readDashboardMutationState,
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
const multiSelectClassName =
  'border-input bg-background text-foreground min-h-32 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'
const protectedSystemRoleCodes = new Set(['super_admin', 'admin', 'editor', 'viewer'])

function createCurrentRolesHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/dashboard/admin/roles', searchParams, {
    error: undefined,
    mutation: undefined,
    success: undefined,
    target: undefined,
  })
}

function isProtectedSystemRole(
  role: Awaited<ReturnType<typeof loadRolesList>>['data'][number],
): boolean {
  return protectedSystemRoleCodes.has(role.code)
}

function formatPermissionOptionLabel(
  permission: Awaited<ReturnType<typeof loadAssignablePermissions>>[number],
): string {
  const summary = `${permission.resource}:${permission.action}`

  return permission.description ? `${summary} · ${permission.description}` : summary
}

export default async function AdminRolesPage({
  searchParams,
}: AdminRolesPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadRolesList(filters),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readDashboardFlashMessage(resolvedSearchParams)
  const mutationState = readDashboardMutationState(resolvedSearchParams)
  const canReadPermissionDirectory = abilityPayload ? canReadPermissions(abilityPayload) : false
  const canWriteRoles =
    abilityPayload && canReadPermissionDirectory ? canManageRoles(abilityPayload) : false
  const assignablePermissions = canReadPermissionDirectory ? await loadAssignablePermissions() : []
  const returnTo = createCurrentRolesHref(resolvedSearchParams)

  return (
    <PageContainer
      pageTitle="Roles Matrix"
      pageDescription="RBAC role registry with assignment counts, permission breadth, and status filters."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

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

        {!canReadPermissionDirectory ? (
          <Card>
            <CardHeader>
              <CardDescription>Permission boundary</CardDescription>
              <CardTitle>Role editing is restricted</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              当前主体可以读取角色表，但缺少权限目录读取能力，因此不会显示角色创建、编辑和权限绑定入口。
            </CardContent>
          </Card>
        ) : null}

        {canWriteRoles ? (
          <Card>
            <CardHeader>
              <CardDescription>Role lifecycle</CardDescription>
              <CardTitle>Write workflow</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                自定义角色通过弹层完成创建和编辑；系统保留角色保持只读保护。
              </div>
              <ManagementDialog
                contentClassName="sm:max-w-4xl"
                description="创建自定义角色并绑定权限。系统保留角色和权限提升边界仍由后端强制校验。"
                title="Create role"
                triggerId="roles-create-trigger"
                triggerLabel="New role"
              >
                <form
                  action={createRoleAction}
                  aria-label="Create role form"
                  className="grid gap-4"
                >
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-role-name">Role name</FieldLabel>
                      <Input id="create-role-name" name="name" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-code">Role code</FieldLabel>
                      <Input id="create-role-code" name="code" required />
                      <FieldDescription>编码应保持稳定，避免复用系统保留编码。</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-description">Description</FieldLabel>
                      <Input id="create-role-description" name="description" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-sort-order">Sort order</FieldLabel>
                      <Input
                        defaultValue="0"
                        id="create-role-sort-order"
                        name="sortOrder"
                        type="number"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-status">Status</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="active"
                        id="create-role-status"
                        name="status"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                    <Field className="xl:col-span-2">
                      <FieldLabel htmlFor="create-role-permissions">Permission bindings</FieldLabel>
                      <select
                        className={multiSelectClassName}
                        id="create-role-permissions"
                        multiple
                        name="permissionIds"
                        size={Math.max(4, Math.min(assignablePermissions.length, 8))}
                      >
                        {assignablePermissions.map((permission) => (
                          <option key={permission.id} value={permission.id}>
                            {formatPermissionOptionLabel(permission)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="submit">Create role</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

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
                    {canWriteRoles ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => {
                    const protectedRole = isProtectedSystemRole(row)

                    return (
                      <TableRow
                        className={
                          mutationState?.targetId === row.id
                            ? 'bg-muted/50 transition-colors'
                            : undefined
                        }
                        key={row.id}
                      >
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
                        {canWriteRoles ? (
                          <TableCell className="text-right">
                            {protectedRole ? (
                              <Badge variant="outline">seeded</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <ManagementDialog
                                  contentClassName="sm:max-w-4xl"
                                  description="更新角色名称、排序和权限绑定。"
                                  title={`Edit ${row.name}`}
                                  triggerLabel="Edit"
                                  triggerSize="sm"
                                  triggerVariant="outline"
                                >
                                  <form
                                    action={updateRoleAction}
                                    aria-label={`Edit ${row.name}`}
                                    className="grid gap-4"
                                  >
                                    <input name="id" type="hidden" value={row.id} />
                                    <input name="returnTo" type="hidden" value={returnTo} />
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <Field>
                                        <FieldLabel htmlFor={`update-role-name-${row.id}`}>
                                          Role name
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.name}
                                          id={`update-role-name-${row.id}`}
                                          name="name"
                                          required
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-role-code-${row.id}`}>
                                          Role code
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.code}
                                          id={`update-role-code-${row.id}`}
                                          name="code"
                                          required
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-role-description-${row.id}`}>
                                          Description
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.description ?? ''}
                                          id={`update-role-description-${row.id}`}
                                          name="description"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-role-sort-${row.id}`}>
                                          Sort order
                                        </FieldLabel>
                                        <Input
                                          defaultValue={String(row.sortOrder)}
                                          id={`update-role-sort-${row.id}`}
                                          name="sortOrder"
                                          type="number"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-role-status-${row.id}`}>
                                          Status
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.status ? 'active' : 'inactive'}
                                          id={`update-role-status-${row.id}`}
                                          name="status"
                                        >
                                          <option value="active">Active</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </Field>
                                      <Field className="xl:col-span-2">
                                        <FieldLabel htmlFor={`update-role-permissions-${row.id}`}>
                                          Permission bindings
                                        </FieldLabel>
                                        <select
                                          className={multiSelectClassName}
                                          defaultValue={row.permissionIds}
                                          id={`update-role-permissions-${row.id}`}
                                          multiple
                                          name="permissionIds"
                                          size={Math.max(
                                            4,
                                            Math.min(assignablePermissions.length, 8),
                                          )}
                                        >
                                          {assignablePermissions.map((permission) => (
                                            <option key={permission.id} value={permission.id}>
                                              {formatPermissionOptionLabel(permission)}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                      <Button type="submit">Save changes</Button>
                                    </div>
                                  </form>
                                </ManagementDialog>
                                <DestructiveActionDialog
                                  action={deleteRoleAction}
                                  confirmLabel="Delete role"
                                  consequences="删除角色会移除其全部权限绑定，并可能影响已分配用户的可见能力。"
                                  description="确认后将永久删除该自定义角色。"
                                  hiddenFields={[
                                    { name: 'id', value: row.id },
                                    { name: 'returnTo', value: returnTo },
                                  ]}
                                  title={`Delete ${row.name}?`}
                                  triggerLabel="Delete"
                                />
                              </div>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
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
