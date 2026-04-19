import { appActions, appSubjects, type MenuEntry } from '@ai-native-os/shared'
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
  createMenuAction,
  deleteMenuAction,
  updateMenuAction,
} from '@/app/(dashboard)/system/menus/actions'
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { DestructiveActionDialog } from '@/components/management/destructive-action-dialog'
import { FilterSelect } from '@/components/management/filter-select'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { ManagementDialog } from '@/components/management/management-dialog'
import {
  OperatorSelectionCheckbox,
  OperatorSelectionHeader,
  OperatorWorkbench,
} from '@/components/management/operator-workbench'
import { PageFeedbackBanner } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { canManageMenus } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createMenuFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadMenusList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface MenusPageProps {
  searchParams: Promise<DashboardSearchParams>
}

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

const formControlClassName =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

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
function createCurrentMenusHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/system/menus', searchParams, {
    error: undefined,
    success: undefined,
  })
}

/**
 * 判断当前菜单是否属于系统基线菜单，供 UI 输出只读提示。
 */
function isProtectedSeedMenu(menuEntry: MenuEntry): boolean {
  return menuEntry.path !== null && protectedSeedMenuPaths.has(menuEntry.path)
}

/**
 * 为父级选择器筛选可用目录节点，避免把菜单挂到非目录节点下。
 */
function getDirectoryOptions(
  menuEntries: readonly MenuEntry[],
  excludeMenuId?: string,
): MenuEntry[] {
  return menuEntries.filter(
    (menuEntry) => menuEntry.type === 'directory' && menuEntry.id !== excludeMenuId,
  )
}

/**
 * 将可空字段回显成输入框可读值，避免 `null` 渲染成字符串。
 */
function stringifyNullableValue(value: string | null): string {
  return value ?? ''
}

export default async function SystemMenusPage({
  searchParams,
}: MenusPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createMenuFilterState(resolvedSearchParams)
  const [payload, menuOptionsPayload, abilityPayload] = await Promise.all([
    loadMenusList(filters),
    loadMenusList({
      page: 1,
      pageSize: 200,
      search: undefined,
      status: 'all',
      visible: 'all',
    }),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readFlashMessage(resolvedSearchParams)
  const returnTo = createCurrentMenusHref(resolvedSearchParams)
  const canWriteMenus = abilityPayload ? canManageMenus(abilityPayload) : false
  const directoryOptions = getDirectoryOptions(menuOptionsPayload.data)

  return (
    <DataSurfacePage
      description="Navigation registry rendered directly from the contract-first API. This surface now supports audited create, update, and delete flows for custom menus while keeping seeded baseline nodes read-only."
      eyebrow="System Module"
      facts={[
        {
          label: 'Visibility filter',
          value: filters.visible,
        },
        {
          label: 'Status filter',
          value: filters.status,
        },
        {
          label: 'Mutation mode',
          value: canWriteMenus ? 'write-enabled' : 'read-only',
        },
      ]}
      metrics={[
        {
          detail: 'Total menu nodes exposed by the documented system contract.',
          label: 'Menu records',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Entries in the current page slice that are visible in navigation contexts.',
          label: 'Visible items',
          value: formatCount(payload.data.filter((row) => row.visible).length),
        },
        {
          detail: 'Entries currently bound to explicit permission metadata.',
          label: 'Protected routes',
          value: formatCount(
            payload.data.filter((row) => row.permissionAction && row.permissionResource).length,
          ),
        },
      ]}
      title="Navigation Registry"
    >
      {flashMessage ? (
        <PageFeedbackBanner kind={flashMessage.kind} message={flashMessage.message} />
      ) : null}

      <FilterToolbar
        actionHref="/system/menus"
        pageSize={filters.pageSize}
        resetHref="/system/menus"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search menu name or path"
      >
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <FilterSelect defaultValue={filters.status} id="status" name="status">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </FilterSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="visible">Visibility</FieldLabel>
          <FilterSelect defaultValue={filters.visible} id="visible" name="visible">
            <option value="all">All visibility</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </FilterSelect>
        </Field>
      </FilterToolbar>

      {canWriteMenus ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-background/72 px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-foreground">Navigation authoring</p>
            <p className="text-sm leading-6 text-muted-foreground">
              自定义菜单通过弹层维护，表格保留路由、权限和可见性状态用于快速扫描。
            </p>
          </div>
          <ManagementDialog
            contentClassName="w-[min(92vw,52rem)]"
            description="创建自定义菜单节点。父级必须是目录节点，叶子菜单必须带路径，权限动作与资源必须成对填写。"
            title="Create menu"
            triggerId="menus-create-trigger"
            triggerLabel="New menu"
          >
            <form action={createMenuAction} aria-label="Create menu form" className="grid gap-4">
              <input name="returnTo" type="hidden" value={returnTo} />
              <div className="grid gap-4 xl:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="create-menu-name">Name</FieldLabel>
                  <Input defaultValue="" id="create-menu-name" name="name" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-menu-type">Type</FieldLabel>
                  <select
                    className={formControlClassName}
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
                    className={formControlClassName}
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
                    defaultValue=""
                    id="create-menu-path"
                    name="path"
                    placeholder="/system/menus"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-menu-component">Component</FieldLabel>
                  <Input
                    defaultValue=""
                    id="create-menu-component"
                    name="component"
                    placeholder="system/menus/page"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-menu-icon">Icon</FieldLabel>
                  <Input defaultValue="" id="create-menu-icon" name="icon" placeholder="menu" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-menu-visible">Visibility</FieldLabel>
                  <select
                    className={formControlClassName}
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
                    className={formControlClassName}
                    defaultValue="active"
                    id="create-menu-status"
                    name="status"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-menu-permission-action">Permission action</FieldLabel>
                  <select
                    className={formControlClassName}
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
                    className={formControlClassName}
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
                  <FieldHint>若填写权限，动作与资源必须同时配置。</FieldHint>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit">Create menu</Button>
              </div>
            </form>
          </ManagementDialog>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
          当前主体只有读取权限。菜单创建、编辑、删除表单仅对具备 `manage:Menu` 或 `manage:all`
          的主体显示。
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <OperatorWorkbench
            primaryActionLabel={canWriteMenus ? 'New menu' : undefined}
            primaryActionTargetId={canWriteMenus ? 'menus-create-trigger' : undefined}
            selectionItems={payload.data.map((row) => ({
              id: row.id,
              label: `${row.name} · ${row.path ?? 'no-path'}`,
            }))}
            surfaceLabel="Menus operator workbench"
          >
            <ResponsiveTableRegion label="Menus registry table" minWidthClassName="min-w-[74rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">
                      <OperatorSelectionHeader />
                    </TableHead>
                    <TableHead>Menu</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => {
                    const isProtected = isProtectedSeedMenu(row)

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="align-top">
                          <OperatorSelectionCheckbox
                            itemId={row.id}
                            label={`${row.name} ${row.path ?? 'no-path'}`}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1">
                            <span className="font-medium">{row.name}</span>
                            <span className="text-sm text-muted-foreground">
                              created {formatDateTime(row.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {row.path ?? 'no-path'}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline">{row.type}</Badge>
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {row.permissionAction && row.permissionResource
                            ? `${row.permissionAction}:${row.permissionResource}`
                            : 'public shell'}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={row.visible ? 'accent' : 'secondary'}>
                              {row.visible ? 'visible' : 'hidden'}
                            </Badge>
                            <Badge variant={row.status ? 'outline' : 'secondary'}>
                              {row.status ? 'active' : 'inactive'}
                            </Badge>
                            {isProtected ? <Badge variant="secondary">seeded</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {canWriteMenus ? (
                            isProtected ? (
                              <span className="text-sm text-muted-foreground">Seeded</span>
                            ) : (
                              <div className="grid gap-3">
                                <ManagementDialog
                                  contentClassName="w-[min(92vw,52rem)]"
                                  description="更新自定义菜单节点的路径、父子关系、可见性与权限绑定。"
                                  title={`Edit ${row.name}`}
                                  triggerLabel="Edit"
                                  triggerSize="sm"
                                  triggerVariant="secondary"
                                >
                                  <form
                                    action={updateMenuAction}
                                    aria-label="Update menu form"
                                    className="grid gap-4"
                                  >
                                    <input name="id" type="hidden" value={row.id} />
                                    <input name="returnTo" type="hidden" value={returnTo} />

                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <Field>
                                        <FieldLabel htmlFor={`menu-name-${row.id}`}>
                                          Name
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.name}
                                          id={`menu-name-${row.id}`}
                                          name="name"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-type-${row.id}`}>
                                          Type
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.type}
                                          id={`menu-type-${row.id}`}
                                          name="type"
                                        >
                                          <option value="directory">directory</option>
                                          <option value="menu">menu</option>
                                          <option value="button">button</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-parent-${row.id}`}>
                                          Parent directory
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.parentId ?? ''}
                                          id={`menu-parent-${row.id}`}
                                          name="parentId"
                                        >
                                          <option value="">Top level</option>
                                          {getDirectoryOptions(menuOptionsPayload.data, row.id).map(
                                            (menuEntry) => (
                                              <option key={menuEntry.id} value={menuEntry.id}>
                                                {menuEntry.name}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-sort-order-${row.id}`}>
                                          Sort order
                                        </FieldLabel>
                                        <Input
                                          defaultValue={String(row.sortOrder)}
                                          id={`menu-sort-order-${row.id}`}
                                          name="sortOrder"
                                          type="number"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-path-${row.id}`}>
                                          Path
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.path)}
                                          id={`menu-path-${row.id}`}
                                          name="path"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-component-${row.id}`}>
                                          Component
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.component)}
                                          id={`menu-component-${row.id}`}
                                          name="component"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-icon-${row.id}`}>
                                          Icon
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.icon)}
                                          id={`menu-icon-${row.id}`}
                                          name="icon"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-visible-${row.id}`}>
                                          Visibility
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.visible ? 'visible' : 'hidden'}
                                          id={`menu-visible-${row.id}`}
                                          name="visible"
                                        >
                                          <option value="visible">visible</option>
                                          <option value="hidden">hidden</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-status-${row.id}`}>
                                          Status
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.status ? 'active' : 'inactive'}
                                          id={`menu-status-${row.id}`}
                                          name="status"
                                        >
                                          <option value="active">active</option>
                                          <option value="inactive">inactive</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`menu-permission-action-${row.id}`}>
                                          Permission action
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.permissionAction ?? ''}
                                          id={`menu-permission-action-${row.id}`}
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
                                        <FieldLabel htmlFor={`menu-permission-resource-${row.id}`}>
                                          Permission resource
                                        </FieldLabel>
                                        <select
                                          className={formControlClassName}
                                          defaultValue={row.permissionResource ?? ''}
                                          id={`menu-permission-resource-${row.id}`}
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

                                    <div className="flex justify-end">
                                      <Button type="submit" variant="secondary">
                                        Save changes
                                      </Button>
                                    </div>
                                  </form>
                                </ManagementDialog>

                                <DestructiveActionDialog
                                  action={deleteMenuAction}
                                  consequences="删除前必须先清空全部子节点；系统种子菜单仍由后端只读保护。"
                                  description="确认后将永久删除该自定义菜单节点，并写入标准化操作日志。"
                                  hiddenFields={[
                                    { name: 'id', value: row.id },
                                    { name: 'returnTo', value: returnTo },
                                  ]}
                                  title={`Delete ${row.name}?`}
                                  triggerLabel="Delete"
                                />
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
          </OperatorWorkbench>
        </div>

        <div className="grid gap-4">
          <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <FieldLabel>Route shape</FieldLabel>
            <FieldHint>
              目录节点允许无路径；叶子节点必须带路径，且 `menu` 类型需要显式组件标识。
            </FieldHint>
          </Field>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Binding notes
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>种子菜单保持只读，自定义菜单才允许在该界面中修改和删除。</p>
              <p>父级菜单必须是目录节点，且删除前必须先清空所有子节点。</p>
            </div>
          </div>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/system/menus', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/system/menus', resolvedSearchParams, {
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
