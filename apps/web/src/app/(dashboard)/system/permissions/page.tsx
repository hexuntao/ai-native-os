import { appActions, appSubjects, type PermissionEntry } from '@ai-native-os/shared'
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
  createPermissionAction,
  deletePermissionAction,
  updatePermissionAction,
} from '@/app/(dashboard)/system/permissions/actions'
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { ManagementDialog } from '@/components/management/management-dialog'
import { PageFeedbackBanner } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { canManagePermissions } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createPermissionFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadPermissionsList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface PermissionsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

const protectedSeedPermissionKeys = new Set([
  'manage:all',
  'manage:User',
  'manage:Role',
  'manage:Menu',
  'manage:Dict',
  'read:OperationLog',
  'read:AiAuditLog',
  'manage:AiKnowledge',
  'read:User',
  'create:User',
  'update:User',
  'read:Dict',
  'export:Report',
  'read:Role',
  'read:Menu',
])

const formControlClassName =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

const textAreaClassName =
  'min-h-28 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

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
function createCurrentPermissionsHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/system/permissions', searchParams, {
    error: undefined,
    success: undefined,
  })
}

/**
 * 判断当前权限是否属于系统基线权限，供 UI 显示只读保护提示。
 */
function isProtectedSeedPermission(permission: PermissionEntry): boolean {
  return protectedSeedPermissionKeys.has(`${permission.action}:${permission.resource}`)
}

/**
 * 把字段列表回显为逗号分隔字符串，便于表单编辑。
 */
function stringifyFields(fields: readonly string[] | null): string {
  return fields?.join(', ') ?? ''
}

/**
 * 把条件对象格式化为 JSON 文本，供表单编辑使用。
 */
function stringifyConditions(conditions: Record<string, unknown> | null): string {
  return conditions ? JSON.stringify(conditions, null, 2) : ''
}

export default async function SystemPermissionsPage({
  searchParams,
}: PermissionsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createPermissionFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadPermissionsList(filters),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readFlashMessage(resolvedSearchParams)
  const returnTo = createCurrentPermissionsHref(resolvedSearchParams)
  const canWritePermissions = abilityPayload ? canManagePermissions(abilityPayload) : false

  return (
    <DataSurfacePage
      description="Permission topology rendered directly from the contract-first API. This surface now supports audited create, update, and delete flows for custom permissions while keeping seeded baseline rules read-only."
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
        {
          label: 'Mutation mode',
          value: canWritePermissions ? 'write-enabled' : 'read-only',
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
          detail: 'Records currently bound to at least one role.',
          label: 'Role linked',
          value: formatCount(payload.data.filter((row) => row.roleCount > 0).length),
        },
      ]}
      title="Permission Center"
    >
      {flashMessage ? (
        <PageFeedbackBanner kind={flashMessage.kind} message={flashMessage.message} />
      ) : null}

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
          <Badge variant={canWritePermissions ? 'accent' : 'secondary'}>
            {canWritePermissions ? 'write-enabled' : 'read-only'}
          </Badge>
        </div>
      </form>

      {canWritePermissions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-background/72 px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-foreground">Permission authoring</p>
            <p className="text-sm leading-6 text-muted-foreground">
              自定义权限通过弹层式编辑维护，列表保持为高密度拓扑视图。
            </p>
          </div>
          <ManagementDialog
            contentClassName="w-[min(92vw,48rem)]"
            description="创建自定义权限规则；系统基线权限和完全重复规则仍会被后端拒绝。"
            title="Create permission"
            triggerLabel="New permission"
          >
            <form action={createPermissionAction} className="grid gap-4">
              <input name="returnTo" type="hidden" value={returnTo} />
              <div className="grid gap-4 xl:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="create-permission-resource">Resource</FieldLabel>
                  <select
                    className={formControlClassName}
                    defaultValue="User"
                    id="create-permission-resource"
                    name="resource"
                  >
                    {appSubjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-permission-action">Action</FieldLabel>
                  <select
                    className={formControlClassName}
                    defaultValue="read"
                    id="create-permission-action"
                    name="action"
                  >
                    {appActions.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-permission-mode">Mode</FieldLabel>
                  <select
                    className={formControlClassName}
                    defaultValue="allow"
                    id="create-permission-mode"
                    name="mode"
                  >
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-permission-description">Description</FieldLabel>
                  <Input id="create-permission-description" name="description" />
                </Field>
                <Field className="xl:col-span-2">
                  <FieldLabel htmlFor="create-permission-fields">Fields CSV</FieldLabel>
                  <Input
                    id="create-permission-fields"
                    name="fields"
                    placeholder="status, approverId"
                  />
                  <FieldHint>留空表示不限制字段范围。</FieldHint>
                </Field>
                <Field className="xl:col-span-2">
                  <FieldLabel htmlFor="create-permission-conditions">Conditions JSON</FieldLabel>
                  <textarea
                    className={textAreaClassName}
                    defaultValue=""
                    id="create-permission-conditions"
                    name="conditions"
                    placeholder='{"department":"finance"}'
                  />
                  <FieldHint>必须是 JSON 对象；留空表示无条件。</FieldHint>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit">Create permission</Button>
              </div>
            </form>
          </ManagementDialog>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
          当前主体只有读取权限。权限创建、编辑、删除表单仅对具备 `manage:Permission` 或 `manage:all`
          的主体显示。
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Field scope</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.data.map((row: PermissionEntry) => {
                const protectedPermission = isProtectedSeedPermission(row)

                return (
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
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={row.inverted ? 'secondary' : 'accent'}>
                          {row.inverted ? 'deny' : 'allow'}
                        </Badge>
                        {protectedPermission ? <Badge variant="secondary">seeded</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.fields?.length ? row.fields.join(', ') : 'all fields'}
                    </TableCell>
                    <TableCell className="max-w-[20rem] text-muted-foreground">
                      {row.conditions ? JSON.stringify(row.conditions) : 'none'}
                    </TableCell>
                    <TableCell className="font-medium">{formatCount(row.roleCount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      {canWritePermissions ? (
                        protectedPermission ? (
                          <div className="text-sm leading-6 text-muted-foreground">
                            系统基线权限只读，不能在该界面修改或删除。
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            <ManagementDialog
                              contentClassName="w-[min(92vw,48rem)]"
                              description="更新自定义权限规则；若当前已被角色引用，语义变更仍受后端保护。"
                              title={`Edit ${row.action}:${row.resource}`}
                              triggerLabel="Edit"
                              triggerSize="sm"
                              triggerVariant="secondary"
                            >
                              <form action={updatePermissionAction} className="grid gap-3">
                                <input name="id" type="hidden" value={row.id} />
                                <input name="returnTo" type="hidden" value={returnTo} />
                                <Field>
                                  <FieldLabel htmlFor={`permission-resource-${row.id}`}>
                                    Resource
                                  </FieldLabel>
                                  <select
                                    className={formControlClassName}
                                    defaultValue={row.resource}
                                    id={`permission-resource-${row.id}`}
                                    name="resource"
                                  >
                                    {appSubjects.map((subject) => (
                                      <option key={subject} value={subject}>
                                        {subject}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`permission-action-${row.id}`}>
                                    Action
                                  </FieldLabel>
                                  <select
                                    className={formControlClassName}
                                    defaultValue={row.action}
                                    id={`permission-action-${row.id}`}
                                    name="action"
                                  >
                                    {appActions.map((action) => (
                                      <option key={action} value={action}>
                                        {action}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`permission-mode-${row.id}`}>
                                    Mode
                                  </FieldLabel>
                                  <select
                                    className={formControlClassName}
                                    defaultValue={row.inverted ? 'deny' : 'allow'}
                                    id={`permission-mode-${row.id}`}
                                    name="mode"
                                  >
                                    <option value="allow">Allow</option>
                                    <option value="deny">Deny</option>
                                  </select>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`permission-description-${row.id}`}>
                                    Description
                                  </FieldLabel>
                                  <Input
                                    defaultValue={row.description ?? ''}
                                    id={`permission-description-${row.id}`}
                                    name="description"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`permission-fields-${row.id}`}>
                                    Fields CSV
                                  </FieldLabel>
                                  <Input
                                    defaultValue={stringifyFields(row.fields)}
                                    id={`permission-fields-${row.id}`}
                                    name="fields"
                                  />
                                </Field>
                                <Field className="lg:col-span-2">
                                  <FieldLabel htmlFor={`permission-conditions-${row.id}`}>
                                    Conditions JSON
                                  </FieldLabel>
                                  <textarea
                                    className={textAreaClassName}
                                    defaultValue={stringifyConditions(row.conditions)}
                                    id={`permission-conditions-${row.id}`}
                                    name="conditions"
                                  />
                                  {row.roleCount > 0 ? (
                                    <FieldHint>
                                      当前已有 {row.roleCount}{' '}
                                      个角色引用。若要改动规则语义，请先解除角色绑定。
                                    </FieldHint>
                                  ) : null}
                                </Field>
                                <div className="flex justify-end">
                                  <Button size="sm" type="submit" variant="secondary">
                                    Save changes
                                  </Button>
                                </div>
                              </form>
                            </ManagementDialog>

                            <form action={deletePermissionAction}>
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
        </div>

        <div className="grid gap-4">
          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Policy boundary</FieldLabel>
            <FieldHint>Seed 权限只读；已被角色引用的权限不能直接改写规则语义或删除。</FieldHint>
          </Field>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Governance notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                权限写操作会写入标准化审计日志；运行时生效仍以 API 侧 CASL 判定为准，前端不会绕过。
              </p>
              <p>
                JSON 条件和字段范围统一以 contract-first schema
                为准，非法输入会在服务端和页面动作层双重拦截。
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
