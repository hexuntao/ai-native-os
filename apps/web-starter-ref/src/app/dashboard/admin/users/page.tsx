import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from '@/app/dashboard/admin/users/actions'
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
import { canManageUserDirectory } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
  readDashboardFlashMessage,
  readDashboardMutationState,
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
const multiSelectClassName =
  'border-input bg-background text-foreground min-h-32 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

function createCurrentUsersHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/dashboard/admin/users', searchParams, {
    error: undefined,
    mutation: undefined,
    success: undefined,
    target: undefined,
  })
}

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
  const flashMessage = readDashboardFlashMessage(resolvedSearchParams)
  const mutationState = readDashboardMutationState(resolvedSearchParams)
  const canWriteUsers = abilityPayload ? canManageUserDirectory(abilityPayload) : false
  const returnTo = createCurrentUsersHref(resolvedSearchParams)

  return (
    <PageContainer
      pageTitle="Users Directory"
      pageDescription="Authenticated principals, role bindings, and directory status in a starter-based admin surface."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

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

        {canWriteUsers ? (
          <Card>
            <CardHeader>
              <CardDescription>Directory actions</CardDescription>
              <CardTitle>Write workflow</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                新建、编辑和删除都走同一套审计安全服务端动作，列表首屏只保留筛选和目录状态。
              </div>
              <ManagementDialog
                description="创建应用用户、Better Auth credential 身份和 RBAC 角色绑定。"
                title="Create user"
                triggerId="users-create-trigger"
                triggerLabel="New user"
              >
                <form
                  action={createUserAction}
                  aria-label="Create user form"
                  className="grid gap-4"
                >
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-username">Username</FieldLabel>
                      <Input id="create-username" minLength={3} name="username" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-email">Email</FieldLabel>
                      <Input id="create-email" name="email" required type="email" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-nickname">Nickname</FieldLabel>
                      <Input id="create-nickname" name="nickname" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-password">Password</FieldLabel>
                      <Input
                        id="create-password"
                        minLength={12}
                        name="password"
                        required
                        type="password"
                      />
                      <FieldDescription>
                        密码至少 12 位，创建时会同步写入 Better Auth credential。
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-status">Status</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="active"
                        id="create-status"
                        name="status"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-codes">Role bindings</FieldLabel>
                      <select
                        className={multiSelectClassName}
                        id="create-role-codes"
                        multiple
                        name="roleCodes"
                        size={Math.max(3, Math.min(assignableRoles.length, 6))}
                      >
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.code}>
                            {role.name} ({role.code})
                          </option>
                        ))}
                      </select>
                      <FieldDescription>按住 Command / Ctrl 可多选角色。</FieldDescription>
                    </Field>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="submit">Create user</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

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
                    {canWriteUsers ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => (
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
                      {canWriteUsers ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <ManagementDialog
                              description="更新应用用户资料、密码和角色绑定。"
                              title={`Edit ${row.username}`}
                              triggerLabel="Edit"
                              triggerSize="sm"
                              triggerVariant="outline"
                            >
                              <form
                                action={updateUserAction}
                                aria-label={`Edit ${row.username}`}
                                className="grid gap-4"
                              >
                                <input name="id" type="hidden" value={row.id} />
                                <input name="returnTo" type="hidden" value={returnTo} />
                                <div className="grid gap-4 xl:grid-cols-2">
                                  <Field>
                                    <FieldLabel htmlFor={`update-username-${row.id}`}>
                                      Username
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.username}
                                      id={`update-username-${row.id}`}
                                      minLength={3}
                                      name="username"
                                      required
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-email-${row.id}`}>
                                      Email
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.email}
                                      id={`update-email-${row.id}`}
                                      name="email"
                                      required
                                      type="email"
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-nickname-${row.id}`}>
                                      Nickname
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.nickname ?? ''}
                                      id={`update-nickname-${row.id}`}
                                      name="nickname"
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-password-${row.id}`}>
                                      Password reset
                                    </FieldLabel>
                                    <Input
                                      id={`update-password-${row.id}`}
                                      minLength={12}
                                      name="password"
                                      placeholder="Leave blank to keep current password"
                                      type="password"
                                    />
                                    <FieldDescription>
                                      留空表示不重置 Better Auth 密码。
                                    </FieldDescription>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-status-${row.id}`}>
                                      Status
                                    </FieldLabel>
                                    <select
                                      className={selectClassName}
                                      defaultValue={row.status ? 'active' : 'inactive'}
                                      id={`update-status-${row.id}`}
                                      name="status"
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-role-codes-${row.id}`}>
                                      Role bindings
                                    </FieldLabel>
                                    <select
                                      className={multiSelectClassName}
                                      defaultValue={row.roleCodes}
                                      id={`update-role-codes-${row.id}`}
                                      multiple
                                      name="roleCodes"
                                      size={Math.max(3, Math.min(assignableRoles.length, 6))}
                                    >
                                      {assignableRoles.map((role) => (
                                        <option key={role.id} value={role.code}>
                                          {role.name} ({role.code})
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
                              action={deleteUserAction}
                              confirmLabel="Delete user"
                              consequences="删除会同时移除应用用户和认证绑定，现有会话也会失效。"
                              description="确认后将永久删除该用户。"
                              hiddenFields={[
                                { name: 'id', value: row.id },
                                { name: 'returnTo', value: returnTo },
                              ]}
                              title={`Delete ${row.username}?`}
                              triggerLabel="Delete"
                              triggerVariant="ghost"
                            />
                          </div>
                        </TableCell>
                      ) : null}
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
