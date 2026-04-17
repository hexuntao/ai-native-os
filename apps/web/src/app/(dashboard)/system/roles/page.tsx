import type { PermissionListResponse, RoleEntry, RoleListResponse } from '@ai-native-os/shared'
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
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from '@/app/(dashboard)/system/roles/actions'
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { FilterSelect } from '@/components/management/filter-select'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { ManagementDialog } from '@/components/management/management-dialog'
import { PageFeedbackBanner } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
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

interface RolesPageProps {
  searchParams: Promise<DashboardSearchParams>
}

type AssignablePermission = PermissionListResponse['data'][number]
type AssignableRole = RoleListResponse['data'][number]

const formControlClassName =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

const multiSelectClassName =
  'min-h-32 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

const protectedSystemRoleCodes = new Set(['super_admin', 'admin', 'editor', 'viewer'])

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
function createCurrentRolesHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/system/roles', searchParams, {
    error: undefined,
    success: undefined,
  })
}

/**
 * 判断一个角色是否属于系统保留角色，供 UI 显示只读保护提示。
 */
function isProtectedSystemRole(role: AssignableRole): boolean {
  return protectedSystemRoleCodes.has(role.code)
}

/**
 * 组合权限标签，便于在多选器中快速识别资源动作和用途说明。
 */
function formatPermissionOptionLabel(permission: AssignablePermission): string {
  const summary = `${permission.resource}:${permission.action}`

  return permission.description ? `${summary} · ${permission.description}` : summary
}

export default async function SystemRolesPage({
  searchParams,
}: RolesPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams)
  const [payload, assignablePermissions, abilityPayload] = await Promise.all([
    loadRolesList(filters),
    loadAssignablePermissions(),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readFlashMessage(resolvedSearchParams)
  const returnTo = createCurrentRolesHref(resolvedSearchParams)
  const canWriteRoles = abilityPayload ? canManageRoles(abilityPayload) : false

  return (
    <DataSurfacePage
      description="Contract-first role registry backed by the authenticated system API. This surface supports audited create, update, and delete flows for custom roles while keeping seeded system roles read-only."
      eyebrow="System Module"
      facts={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All role names',
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
        {
          label: 'Mutation mode',
          value: canWriteRoles ? 'write-enabled' : 'read-only',
        },
      ]}
      metrics={[
        {
          detail: 'Total RBAC roles returned by the system contract.',
          label: 'Roles',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Combined user assignments represented in this page slice.',
          label: 'Assignments',
          value: formatCount(payload.data.reduce((sum, row) => sum + row.userCount, 0)),
        },
        {
          detail: 'Assignable permission rules exposed to the role editor.',
          label: 'Permissions',
          value: formatCount(assignablePermissions.length),
        },
      ]}
      title="Roles Matrix"
    >
      {flashMessage ? (
        <PageFeedbackBanner kind={flashMessage.kind} message={flashMessage.message} />
      ) : null}

      <FilterToolbar
        actionHref="/system/roles"
        pageSize={filters.pageSize}
        resetHref="/system/roles"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search role name"
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

      {canWriteRoles ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-background/72 px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-foreground">Role lifecycle</p>
            <p className="text-sm leading-6 text-muted-foreground">
              自定义角色通过弹层完成创建和编辑，列表首屏只保留筛选、状态和分配关系。
            </p>
          </div>
          <ManagementDialog
            contentClassName="w-[min(92vw,48rem)]"
            description="创建自定义角色并绑定权限。系统保留角色和权限提升边界仍由后端强制校验。"
            title="Create role"
            triggerLabel="New role"
          >
            <form action={createRoleAction} aria-label="Create role form" className="grid gap-4">
              <input name="returnTo" type="hidden" value={returnTo} />
              <div className="grid gap-4 xl:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="create-role-name">Role name</FieldLabel>
                  <Input id="create-role-name" name="name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-role-code">Role code</FieldLabel>
                  <Input id="create-role-code" name="code" required />
                  <FieldHint>编码应保持稳定，避免复用系统保留编码。</FieldHint>
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
                    className={formControlClassName}
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
                    {assignablePermissions.map((permission: AssignablePermission) => (
                      <option key={permission.id} value={permission.id}>
                        {formatPermissionOptionLabel(permission)}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    按住 Command / Ctrl 可多选权限；保留权限提升和系统角色保护仍由后端强制校验。
                  </FieldHint>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit">Create role</Button>
              </div>
            </form>
          </ManagementDialog>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
          当前主体只有读取权限。角色创建、编辑、删除表单仅对具备 `manage:Role` 或 `manage:all`
          的主体显示。
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <ResponsiveTableRegion label="Roles matrix table" minWidthClassName="min-w-[68rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.data.map((row: RoleEntry) => {
                  const protectedRole = isProtectedSystemRole(row)

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{row.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {row.description ?? 'No description'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{row.code}</Badge>
                          <Badge variant={row.status ? 'accent' : 'secondary'}>
                            {row.status ? 'active' : 'inactive'}
                          </Badge>
                          {protectedRole ? <Badge variant="secondary">seeded</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCount(row.userCount)}</TableCell>
                      <TableCell>
                        <div className="grid gap-2">
                          <span className="font-medium">{formatCount(row.permissionCount)}</span>
                          <div className="flex flex-wrap gap-2">
                            {row.permissionIds.length === 0 ? (
                              <Badge variant="secondary">none</Badge>
                            ) : (
                              row.permissionIds.slice(0, 3).map((permissionId: string) => (
                                <Badge key={permissionId} variant="outline">
                                  {permissionId.slice(0, 8)}
                                </Badge>
                              ))
                            )}
                            {row.permissionIds.length > 3 ? (
                              <Badge variant="secondary">+{row.permissionIds.length - 3}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.updatedAt)}
                      </TableCell>
                      <TableCell className="align-top">
                        {canWriteRoles ? (
                          protectedRole ? (
                            <div className="text-sm leading-6 text-muted-foreground">
                              系统保留角色只读，不能在该界面修改或删除。
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              <ManagementDialog
                                contentClassName="w-[min(92vw,48rem)]"
                                description="更新自定义角色的名称、状态、排序和权限绑定。"
                                title={`Edit ${row.name}`}
                                triggerLabel="Edit"
                                triggerSize="sm"
                                triggerVariant="secondary"
                              >
                                <form
                                  action={updateRoleAction}
                                  aria-label="Update role form"
                                  className="grid gap-3"
                                >
                                  <input name="id" type="hidden" value={row.id} />
                                  <input name="returnTo" type="hidden" value={returnTo} />
                                  <Field>
                                    <FieldLabel htmlFor={`role-name-${row.id}`}>
                                      Role name
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.name}
                                      id={`role-name-${row.id}`}
                                      name="name"
                                      required
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`role-code-${row.id}`}>
                                      Role code
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.code}
                                      id={`role-code-${row.id}`}
                                      name="code"
                                      required
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`role-description-${row.id}`}>
                                      Description
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.description ?? ''}
                                      id={`role-description-${row.id}`}
                                      name="description"
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`role-sort-order-${row.id}`}>
                                      Sort order
                                    </FieldLabel>
                                    <Input
                                      defaultValue={String(row.sortOrder)}
                                      id={`role-sort-order-${row.id}`}
                                      name="sortOrder"
                                      type="number"
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`role-status-${row.id}`}>
                                      Status
                                    </FieldLabel>
                                    <select
                                      className={formControlClassName}
                                      defaultValue={row.status ? 'active' : 'inactive'}
                                      id={`role-status-${row.id}`}
                                      name="status"
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                    <FieldHint>
                                      停用前应先解除所有用户绑定，否则后端会拒绝提交。
                                    </FieldHint>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`role-permissions-${row.id}`}>
                                      Permission bindings
                                    </FieldLabel>
                                    <select
                                      className={multiSelectClassName}
                                      defaultValue={row.permissionIds}
                                      id={`role-permissions-${row.id}`}
                                      multiple
                                      name="permissionIds"
                                      size={Math.max(4, Math.min(assignablePermissions.length, 8))}
                                    >
                                      {assignablePermissions.map(
                                        (permission: AssignablePermission) => (
                                          <option key={permission.id} value={permission.id}>
                                            {formatPermissionOptionLabel(permission)}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </Field>
                                  <div className="flex justify-end">
                                    <Button size="sm" type="submit" variant="secondary">
                                      Save changes
                                    </Button>
                                  </div>
                                </form>
                              </ManagementDialog>

                              <form action={deleteRoleAction}>
                                <input name="id" type="hidden" value={row.id} />
                                <input name="returnTo" type="hidden" value={returnTo} />
                                <Button size="sm" type="submit" variant="ghost">
                                  Delete
                                </Button>
                              </form>
                            </div>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">Read only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ResponsiveTableRegion>
        </div>

        <div className="grid gap-4">
          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Guardrails</FieldLabel>
            <FieldHint>基线角色只读；在用角色必须先解除用户绑定后才能停用或删除。</FieldHint>
          </Field>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Governance notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                角色写操作会同步更新权限绑定并写入标准化操作日志，前端不会绕过 RBAC 或审计约束。
              </p>
              <p>系统保留角色继续由 seed 与文档治理，当前界面只负责管理自定义角色生命周期。</p>
            </div>
          </div>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/roles', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/roles', resolvedSearchParams, {
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
