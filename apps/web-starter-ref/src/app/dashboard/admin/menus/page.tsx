import { appActions, appSubjects } from '@ai-native-os/shared'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  createMenuAction,
  deleteMenuAction,
  updateMenuAction,
} from '@/app/dashboard/admin/menus/actions'
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
import { canManageMenus } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createMenuFilterState,
  type DashboardSearchParams,
  readDashboardFlashMessage,
  readDashboardMutationState,
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
const protectedSeedMenuPaths = new Set([
  '/system',
  '/system/users',
  '/system/roles',
  '/system/menus',
  '/system/dicts',
  '/system/logs',
  '/ai',
  '/ai/knowledge',
  '/reports',
])

function createCurrentMenusHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/dashboard/admin/menus', searchParams, {
    error: undefined,
    mutation: undefined,
    success: undefined,
    target: undefined,
  })
}

function isProtectedSeedMenu(
  menuEntry: Awaited<ReturnType<typeof loadMenusList>>['data'][number],
): boolean {
  return menuEntry.path !== null && protectedSeedMenuPaths.has(menuEntry.path)
}

function getDirectoryOptions(
  menuEntries: readonly Awaited<ReturnType<typeof loadMenusList>>['data'][number][],
  excludeMenuId?: string,
) {
  return menuEntries.filter(
    (menuEntry) => menuEntry.type === 'directory' && menuEntry.id !== excludeMenuId,
  )
}

function stringifyNullableValue(value: string | null): string {
  return value ?? ''
}

export default async function AdminMenusPage({
  searchParams,
}: AdminMenusPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createMenuFilterState(resolvedSearchParams)
  const [payload, menuOptionsPayload, abilityPayload] = await Promise.all([
    loadMenusList(filters),
    loadMenusList({
      page: 1,
      pageSize: 100,
      search: undefined,
      status: 'all',
      visible: 'all',
    }),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readDashboardFlashMessage(resolvedSearchParams)
  const mutationState = readDashboardMutationState(resolvedSearchParams)
  const canWriteMenus = abilityPayload ? canManageMenus(abilityPayload) : false
  const returnTo = createCurrentMenusHref(resolvedSearchParams)
  const directoryOptions = getDirectoryOptions(menuOptionsPayload.data)

  return (
    <PageContainer
      pageTitle="Navigation Registry"
      pageDescription="Menu topology with path, permission, visibility, and status state."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

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

        {canWriteMenus ? (
          <Card>
            <CardHeader>
              <CardDescription>Navigation authoring</CardDescription>
              <CardTitle>Write workflow</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                自定义菜单通过弹层维护，表格保留路由、权限和可见性状态用于快速扫描。
              </div>
              <ManagementDialog
                contentClassName="sm:max-w-5xl"
                description="创建自定义菜单节点。父级必须是目录节点，叶子菜单必须带路径，权限动作与资源必须成对填写。"
                title="Create menu"
                triggerId="menus-create-trigger"
                triggerLabel="New menu"
              >
                <form
                  action={createMenuAction}
                  aria-label="Create menu form"
                  className="grid gap-4"
                >
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-menu-name">Name</FieldLabel>
                      <Input id="create-menu-name" name="name" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-type">Type</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="menu"
                        id="create-menu-type"
                        name="type"
                      >
                        <option value="directory">directory</option>
                        <option value="menu">menu</option>
                        <option value="button">button</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-parent">Parent directory</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-parent"
                        name="parentId"
                      >
                        <option value="">Top level</option>
                        {directoryOptions.map((menuEntry) => (
                          <option key={menuEntry.id} value={menuEntry.id}>
                            {menuEntry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-sort-order">Sort order</FieldLabel>
                      <Input
                        defaultValue="0"
                        id="create-menu-sort-order"
                        name="sortOrder"
                        type="number"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-path">Path</FieldLabel>
                      <Input
                        id="create-menu-path"
                        name="path"
                        placeholder="/dashboard/admin/users"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-component">Component</FieldLabel>
                      <Input
                        id="create-menu-component"
                        name="component"
                        placeholder="dashboard/admin/users/page"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-icon">Icon</FieldLabel>
                      <Input id="create-menu-icon" name="icon" placeholder="menu" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-visible">Visibility</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="visible"
                        id="create-menu-visible"
                        name="visible"
                      >
                        <option value="visible">visible</option>
                        <option value="hidden">hidden</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-status">Status</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="active"
                        id="create-menu-status"
                        name="status"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-permission-action">
                        Permission action
                      </FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-permission-action"
                        name="permissionAction"
                      >
                        <option value="">none</option>
                        {appActions.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-permission-resource">
                        Permission resource
                      </FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-permission-resource"
                        name="permissionResource"
                      >
                        <option value="">none</option>
                        {appSubjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                      <FieldDescription>
                        权限动作与资源应成对填写；公共菜单可都留空。
                      </FieldDescription>
                    </Field>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="submit">Create menu</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

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
                    {canWriteMenus ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => {
                    const protectedMenu = isProtectedSeedMenu(row)
                    const editDirectoryOptions = getDirectoryOptions(
                      menuOptionsPayload.data,
                      row.id,
                    )

                    return (
                      <TableRow
                        className={
                          mutationState?.targetId === row.id
                            ? 'bg-muted/50 transition-colors'
                            : undefined
                        }
                        key={row.id}
                      >
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
                        {canWriteMenus ? (
                          <TableCell className="text-right">
                            {protectedMenu ? (
                              <Badge variant="outline">seeded</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <ManagementDialog
                                  contentClassName="sm:max-w-5xl"
                                  description="更新菜单路径、权限绑定和层级关系。"
                                  title={`Edit ${row.name}`}
                                  triggerLabel="Edit"
                                  triggerSize="sm"
                                  triggerVariant="outline"
                                >
                                  <form
                                    action={updateMenuAction}
                                    aria-label={`Edit ${row.name}`}
                                    className="grid gap-4"
                                  >
                                    <input name="id" type="hidden" value={row.id} />
                                    <input name="returnTo" type="hidden" value={returnTo} />
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-name-${row.id}`}>
                                          Name
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.name}
                                          id={`update-menu-name-${row.id}`}
                                          name="name"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-type-${row.id}`}>
                                          Type
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.type}
                                          id={`update-menu-type-${row.id}`}
                                          name="type"
                                        >
                                          <option value="directory">directory</option>
                                          <option value="menu">menu</option>
                                          <option value="button">button</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-parent-${row.id}`}>
                                          Parent directory
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.parentId ?? ''}
                                          id={`update-menu-parent-${row.id}`}
                                          name="parentId"
                                        >
                                          <option value="">Top level</option>
                                          {editDirectoryOptions.map((menuEntry) => (
                                            <option key={menuEntry.id} value={menuEntry.id}>
                                              {menuEntry.name}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-sort-${row.id}`}>
                                          Sort order
                                        </FieldLabel>
                                        <Input
                                          defaultValue={String(row.sortOrder)}
                                          id={`update-menu-sort-${row.id}`}
                                          name="sortOrder"
                                          type="number"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-path-${row.id}`}>
                                          Path
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.path)}
                                          id={`update-menu-path-${row.id}`}
                                          name="path"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-component-${row.id}`}>
                                          Component
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.component)}
                                          id={`update-menu-component-${row.id}`}
                                          name="component"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-icon-${row.id}`}>
                                          Icon
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.icon)}
                                          id={`update-menu-icon-${row.id}`}
                                          name="icon"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-visible-${row.id}`}>
                                          Visibility
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.visible ? 'visible' : 'hidden'}
                                          id={`update-menu-visible-${row.id}`}
                                          name="visible"
                                        >
                                          <option value="visible">visible</option>
                                          <option value="hidden">hidden</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-status-${row.id}`}>
                                          Status
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.status ? 'active' : 'inactive'}
                                          id={`update-menu-status-${row.id}`}
                                          name="status"
                                        >
                                          <option value="active">active</option>
                                          <option value="inactive">inactive</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-action-${row.id}`}>
                                          Permission action
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.permissionAction ?? ''}
                                          id={`update-menu-action-${row.id}`}
                                          name="permissionAction"
                                        >
                                          <option value="">none</option>
                                          {appActions.map((action) => (
                                            <option key={action} value={action}>
                                              {action}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-resource-${row.id}`}>
                                          Permission resource
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.permissionResource ?? ''}
                                          id={`update-menu-resource-${row.id}`}
                                          name="permissionResource"
                                        >
                                          <option value="">none</option>
                                          {appSubjects.map((subject) => (
                                            <option key={subject} value={subject}>
                                              {subject}
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
                                  action={deleteMenuAction}
                                  confirmLabel="Delete menu"
                                  consequences="删除菜单会影响导航拓扑，并可能让关联入口立即消失。"
                                  description="确认后将永久删除该自定义菜单节点。"
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
