import type { RoleListResponse, UserEntry } from '@ai-native-os/shared'
import {
  Badge,
  Button,
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

import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from '@/app/(dashboard)/system/users/actions'
import { GenerativeUsersPanel } from '@/components/generative/generative-users-panel'
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { DestructiveActionDialog } from '@/components/management/destructive-action-dialog'
import { FilterSelect } from '@/components/management/filter-select'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { ManagementDialog } from '@/components/management/management-dialog'
import {
  OperatorPreviewButton,
  OperatorSelectionCheckbox,
  OperatorSelectionHeader,
  OperatorWorkbench,
} from '@/components/management/operator-workbench'
import { PageFeedbackBanner } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
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

interface UsersPageProps {
  searchParams: Promise<DashboardSearchParams>
}

const formControlClassName =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

const multiSelectClassName =
  'min-h-32 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

type AssignableRole = RoleListResponse['data'][number]

/**
 * 从搜索参数中提取一次性反馈消息，供服务端页面渲染操作结果提示。
 */
function readFlashMessage(searchParams: DashboardSearchParams): {
  kind: 'error' | 'success'
  message: string
} | null {
  const errorValue = searchParams.error
  const successValue = searchParams.success
  const normalizedError = Array.isArray(errorValue) ? errorValue[0] : errorValue
  const normalizedSuccess = Array.isArray(successValue) ? successValue[0] : successValue

  if (normalizedError) {
    return {
      kind: 'error',
      message: normalizedError,
    }
  }

  if (normalizedSuccess) {
    return {
      kind: 'success',
      message: normalizedSuccess,
    }
  }

  return null
}

/**
 * 把当前查询状态回写为 returnTo，确保服务端动作完成后能返回同一筛选上下文。
 */
function createCurrentUsersHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/system/users', searchParams, {
    error: undefined,
    success: undefined,
  })
}

export default async function SystemUsersPage({
  searchParams,
}: UsersPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const [payload, assignableRoles, abilityPayload] = await Promise.all([
    loadUsersList(filters),
    loadAssignableRoles(),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readFlashMessage(resolvedSearchParams)
  const returnTo = createCurrentUsersHref(resolvedSearchParams)
  const canManageUsers = abilityPayload ? canManageUserDirectory(abilityPayload) : false

  return (
    <DataSurfacePage
      description="Contract-first operator directory backed by the authenticated system API. This page now supports audit-safe create, update, and delete actions for principals with explicit user-management permission."
      eyebrow="System Module"
      facts={[
        {
          label: 'Search scope',
          value: filters.search ?? 'Usernames and emails',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
        {
          label: 'Mutation mode',
          value: canManageUsers ? 'write-enabled' : 'read-only',
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
          detail: 'Active assignable roles exposed to the user management workflow.',
          label: 'Assignable roles',
          value: formatCount(assignableRoles.length),
        },
      ]}
      title="Users Directory"
    >
      {flashMessage ? (
        <PageFeedbackBanner kind={flashMessage.kind} message={flashMessage.message} />
      ) : null}

      <FilterToolbar
        actionHref="/system/users"
        pageSize={filters.pageSize}
        resetHref="/system/users"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search username or email"
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

      {canManageUsers ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-background/72 px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-foreground">Directory actions</p>
            <p className="text-sm leading-6 text-muted-foreground">
              新建、编辑和删除都走同一套审计安全服务端动作，不再把表单长期铺在列表前面。
            </p>
          </div>
          <ManagementDialog
            description="创建应用用户、Better Auth credential 身份和 RBAC 角色绑定。"
            title="Create user"
            triggerId="users-create-trigger"
            triggerLabel="New user"
          >
            <form action={createUserAction} aria-label="Create user form" className="grid gap-4">
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
                  <FieldHint>密码至少 12 位，创建时会同步写入 Better Auth credential。</FieldHint>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-status">Status</FieldLabel>
                  <select
                    className={formControlClassName}
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
                    {assignableRoles.map((role: AssignableRole) => (
                      <option key={role.id} value={role.code}>
                        {role.name} ({role.code})
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    按住 Command / Ctrl 可多选角色，超级管理员边界仍由后端强制校验。
                  </FieldHint>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit">Create user</Button>
              </div>
            </form>
          </ManagementDialog>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
          当前主体只有读取权限。用户创建、编辑、删除表单仅对具备 `manage:User` 或 `manage:all`
          的主体显示。
        </div>
      )}

      <GenerativeUsersPanel rows={payload.data} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <OperatorWorkbench
            primaryActionLabel={canManageUsers ? 'New user' : undefined}
            primaryActionTargetId={canManageUsers ? 'users-create-trigger' : undefined}
            selectionItems={payload.data.map((row) => ({
              id: row.id,
              label: `${row.username} · ${row.email}`,
              preview: {
                description: row.nickname ?? '该用户尚未配置昵称。',
                eyebrow: 'User preview',
                facts: [
                  { label: 'Email', value: row.email },
                  {
                    label: 'Roles',
                    value: row.roleCodes.length > 0 ? row.roleCodes.join(', ') : 'unassigned',
                  },
                  { label: 'Status', value: row.status ? 'active' : 'inactive' },
                  { label: 'Updated', value: formatDateTime(row.updatedAt) },
                ],
                title: row.username,
              },
            }))}
            surfaceLabel="Users operator workbench"
          >
            <ResponsiveTableRegion label="Users directory table" minWidthClassName="min-w-[70rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">
                      <OperatorSelectionHeader />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row: UserEntry) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <OperatorSelectionCheckbox
                          itemId={row.id}
                          label={`${row.username} ${row.email}`}
                        />
                      </TableCell>
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
                            row.roleCodes.map((roleCode: string) => (
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
                      <TableCell className="align-top">
                        {canManageUsers ? (
                          <div className="grid gap-3">
                            <OperatorPreviewButton itemId={row.id} label="Preview" />
                            <ManagementDialog
                              contentClassName="w-[min(92vw,44rem)]"
                              description="更新用户资料、登录邮箱、可选密码重置和角色绑定。"
                              title={`Edit ${row.username}`}
                              triggerLabel="Edit"
                              triggerSize="sm"
                              triggerVariant="secondary"
                            >
                              <form
                                action={updateUserAction}
                                aria-label="Update user form"
                                className="grid gap-3"
                              >
                                <input name="id" type="hidden" value={row.id} />
                                <input name="returnTo" type="hidden" value={returnTo} />
                                <Field>
                                  <FieldLabel htmlFor={`username-${row.id}`}>Username</FieldLabel>
                                  <Input
                                    defaultValue={row.username}
                                    id={`username-${row.id}`}
                                    name="username"
                                    required
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`email-${row.id}`}>Email</FieldLabel>
                                  <Input
                                    defaultValue={row.email}
                                    id={`email-${row.id}`}
                                    name="email"
                                    required
                                    type="email"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`nickname-${row.id}`}>Nickname</FieldLabel>
                                  <Input
                                    defaultValue={row.nickname ?? ''}
                                    id={`nickname-${row.id}`}
                                    name="nickname"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`password-${row.id}`}>
                                    Reset password
                                  </FieldLabel>
                                  <Input
                                    id={`password-${row.id}`}
                                    minLength={12}
                                    name="password"
                                    type="password"
                                  />
                                  <FieldHint>留空表示不重置密码。</FieldHint>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`status-${row.id}`}>Status</FieldLabel>
                                  <select
                                    className={formControlClassName}
                                    defaultValue={row.status ? 'active' : 'inactive'}
                                    id={`status-${row.id}`}
                                    name="status"
                                  >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`roles-${row.id}`}>Role bindings</FieldLabel>
                                  <select
                                    className={multiSelectClassName}
                                    defaultValue={row.roleCodes}
                                    id={`roles-${row.id}`}
                                    multiple
                                    name="roleCodes"
                                    size={Math.max(3, Math.min(assignableRoles.length, 6))}
                                  >
                                    {assignableRoles.map((role: AssignableRole) => (
                                      <option key={role.id} value={role.code}>
                                        {role.name} ({role.code})
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <div className="flex justify-end">
                                  <Button size="sm" type="submit" variant="secondary">
                                    Save changes
                                  </Button>
                                </div>
                              </form>
                            </ManagementDialog>

                            <DestructiveActionDialog
                              action={deleteUserAction}
                              consequences="删除会移除应用用户主体，并同步清理 Better Auth credential 与角色绑定。"
                              description="确认后将永久删除该用户。该操作会写入审计日志，且无法从前端直接恢复。"
                              hiddenFields={[
                                { name: 'id', value: row.id },
                                { name: 'returnTo', value: returnTo },
                              ]}
                              title={`Delete ${row.username}?`}
                              triggerLabel="Delete"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Read only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableRegion>
          </OperatorWorkbench>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Operator notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                This surface mutates the application user table, Better Auth identities, and RBAC
                role mappings together to avoid directory drift.
              </p>
              <p>
                Destructive and privileged actions remain server-guarded. The UI never bypasses
                RBAC, self-protection, or super-admin boundaries.
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
