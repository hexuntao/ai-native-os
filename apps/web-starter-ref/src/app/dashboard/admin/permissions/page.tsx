import { appActions, appSubjects } from '@ai-native-os/shared'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  createPermissionAction,
  deletePermissionAction,
  updatePermissionAction,
} from '@/app/dashboard/admin/permissions/actions'
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
import { Textarea } from '@/components/ui/textarea'
import { canManagePermissions, canReadPermissions } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createPermissionFilterState,
  type DashboardSearchParams,
  readDashboardFlashMessage,
  readDashboardMutationState,
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
const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

function createCurrentPermissionsHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/dashboard/admin/permissions', searchParams, {
    error: undefined,
    mutation: undefined,
    success: undefined,
    target: undefined,
  })
}

function isProtectedSeedPermission(
  permission: Awaited<ReturnType<typeof loadPermissionsList>>['data'][number],
): boolean {
  return protectedSeedPermissionKeys.has(`${permission.action}:${permission.resource}`)
}

function stringifyFields(fields: readonly string[] | null): string {
  return fields?.join(', ') ?? ''
}

function stringifyConditions(conditions: Record<string, unknown> | null): string {
  return conditions ? JSON.stringify(conditions, null, 2) : ''
}

export default async function AdminPermissionsPage({
  searchParams,
}: AdminPermissionsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createPermissionFilterState(resolvedSearchParams)
  const abilityPayload = await loadSerializedAbilityPayload()
  const flashMessage = readDashboardFlashMessage(resolvedSearchParams)
  const mutationState = readDashboardMutationState(resolvedSearchParams)
  const canReadPermissionDirectory = abilityPayload ? canReadPermissions(abilityPayload) : false
  const canWritePermissions = abilityPayload ? canManagePermissions(abilityPayload) : false
  const returnTo = createCurrentPermissionsHref(resolvedSearchParams)

  if (!canReadPermissionDirectory) {
    return (
      <PageContainer
        pageTitle="Permission Center"
        pageDescription="Permission topology with filters for resource, action, field scope, and role linkage."
        infoContent={createInfoContent()}
      >
        <div className="flex flex-1 flex-col gap-4">
          {flashMessage ? (
            <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
          ) : null}

          <Card>
            <CardHeader>
              <CardDescription>Access boundary</CardDescription>
              <CardTitle>Permission directory is unavailable</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              当前主体缺少 `read:Permission`
              能力，因此页面只显示权限边界说明，不会在服务端请求受限的权限目录接口。
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  const payload = await loadPermissionsList(filters)

  return (
    <PageContainer
      pageTitle="Permission Center"
      pageDescription="Permission topology with filters for resource, action, field scope, and role linkage."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

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

        {canWritePermissions ? (
          <Card>
            <CardHeader>
              <CardDescription>Permission authoring</CardDescription>
              <CardTitle>Write workflow</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                自定义权限通过弹层式编辑维护；系统基线权限保持只读。
              </div>
              <ManagementDialog
                contentClassName="sm:max-w-4xl"
                description="创建自定义权限规则；系统基线权限和完全重复规则仍会被后端拒绝。"
                title="Create permission"
                triggerId="permissions-create-trigger"
                triggerLabel="New permission"
              >
                <form
                  action={createPermissionAction}
                  aria-label="Create permission form"
                  className="grid gap-4"
                >
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-permission-resource">Resource</FieldLabel>
                      <select
                        className={selectClassName}
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
                        className={selectClassName}
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
                        className={selectClassName}
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
                      <FieldDescription>留空表示不限制字段范围。</FieldDescription>
                    </Field>
                    <Field className="xl:col-span-2">
                      <FieldLabel htmlFor="create-permission-conditions">
                        Conditions JSON
                      </FieldLabel>
                      <Textarea
                        id="create-permission-conditions"
                        name="conditions"
                        placeholder={'{\n  "department": "finance"\n}'}
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="submit">Create permission</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

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
                    {canWritePermissions ? (
                      <TableHead className="text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => {
                    const protectedPermission = isProtectedSeedPermission(row)

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
                        {canWritePermissions ? (
                          <TableCell className="text-right">
                            {protectedPermission ? (
                              <Badge variant="outline">seeded</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <ManagementDialog
                                  contentClassName="sm:max-w-4xl"
                                  description="更新资源、动作、字段范围和条件 JSON。"
                                  title={`Edit ${row.action}:${row.resource}`}
                                  triggerLabel="Edit"
                                  triggerSize="sm"
                                  triggerVariant="outline"
                                >
                                  <form
                                    action={updatePermissionAction}
                                    aria-label={`Edit ${row.action}:${row.resource}`}
                                    className="grid gap-4"
                                  >
                                    <input name="id" type="hidden" value={row.id} />
                                    <input name="returnTo" type="hidden" value={returnTo} />
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <Field>
                                        <FieldLabel
                                          htmlFor={`update-permission-resource-${row.id}`}
                                        >
                                          Resource
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.resource}
                                          id={`update-permission-resource-${row.id}`}
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
                                        <FieldLabel htmlFor={`update-permission-action-${row.id}`}>
                                          Action
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.action}
                                          id={`update-permission-action-${row.id}`}
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
                                        <FieldLabel htmlFor={`update-permission-mode-${row.id}`}>
                                          Mode
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.inverted ? 'deny' : 'allow'}
                                          id={`update-permission-mode-${row.id}`}
                                          name="mode"
                                        >
                                          <option value="allow">Allow</option>
                                          <option value="deny">Deny</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel
                                          htmlFor={`update-permission-description-${row.id}`}
                                        >
                                          Description
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.description ?? ''}
                                          id={`update-permission-description-${row.id}`}
                                          name="description"
                                        />
                                      </Field>
                                      <Field className="xl:col-span-2">
                                        <FieldLabel htmlFor={`update-permission-fields-${row.id}`}>
                                          Fields CSV
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyFields(row.fields)}
                                          id={`update-permission-fields-${row.id}`}
                                          name="fields"
                                        />
                                      </Field>
                                      <Field className="xl:col-span-2">
                                        <FieldLabel
                                          htmlFor={`update-permission-conditions-${row.id}`}
                                        >
                                          Conditions JSON
                                        </FieldLabel>
                                        <Textarea
                                          defaultValue={stringifyConditions(row.conditions)}
                                          id={`update-permission-conditions-${row.id}`}
                                          name="conditions"
                                        />
                                      </Field>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                      <Button type="submit">Save changes</Button>
                                    </div>
                                  </form>
                                </ManagementDialog>
                                <DestructiveActionDialog
                                  action={deletePermissionAction}
                                  confirmLabel="Delete permission"
                                  consequences="删除权限会影响所有引用该规则的角色能力推导。"
                                  description="确认后将永久删除该自定义权限规则。"
                                  hiddenFields={[
                                    { name: 'id', value: row.id },
                                    { name: 'returnTo', value: returnTo },
                                  ]}
                                  title={`Delete ${row.action}:${row.resource}?`}
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
