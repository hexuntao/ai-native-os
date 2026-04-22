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
    title: '导航注册表',
    sections: [
      {
        title: '页面用途',
        description: '从已认证导航契约中查看路由菜单定义、权限绑定与可见性状态。',
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
      pageTitle="导航注册表"
      pageDescription="包含路径、权限、可见性与状态信息的菜单拓扑视图。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="menus"
            detail="系统契约暴露的菜单节点总数。"
            label="菜单记录"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="visible"
            detail="当前页面切片中在导航上下文中可见的条目。"
            label="可见项"
            value={formatCount(payload.data.filter((row) => row.visible).length)}
          />
          <MetricCard
            badge="protected"
            detail="当前绑定了显式权限元数据的条目数量。"
            label="受保护路由"
            value={formatCount(
              payload.data.filter((row) => row.permissionAction && row.permissionResource).length,
            )}
          />
          <MetricCard
            badge={canWriteMenus ? 'write-enabled' : 'read-only'}
            detail="当前操作员是否可以修改菜单记录。"
            label="写入模式"
            value={canWriteMenus ? '可写' : '只读'}
            variant={canWriteMenus ? 'secondary' : 'outline'}
          />
        </div>

        {canWriteMenus ? (
          <Card>
            <CardHeader>
              <CardDescription>导航编写</CardDescription>
              <CardTitle>写入工作流</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                自定义菜单通过弹层维护，表格保留路由、权限和可见性状态用于快速扫描。
              </div>
              <ManagementDialog
                contentClassName="sm:max-w-5xl"
                description="创建自定义菜单节点。父级必须是目录节点，叶子菜单必须带路径，权限动作与资源必须成对填写。"
                title="创建菜单"
                triggerId="menus-create-trigger"
                triggerLabel="新建菜单"
              >
                <form action={createMenuAction} aria-label="创建菜单表单" className="grid gap-4">
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-menu-name">名称</FieldLabel>
                      <Input id="create-menu-name" name="name" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-type">类型</FieldLabel>
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
                      <FieldLabel htmlFor="create-menu-parent">父级目录</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-parent"
                        name="parentId"
                      >
                        <option value="">顶级</option>
                        {directoryOptions.map((menuEntry) => (
                          <option key={menuEntry.id} value={menuEntry.id}>
                            {menuEntry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-sort-order">排序</FieldLabel>
                      <Input
                        defaultValue="0"
                        id="create-menu-sort-order"
                        name="sortOrder"
                        type="number"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-path">路径</FieldLabel>
                      <Input
                        id="create-menu-path"
                        name="path"
                        placeholder="/dashboard/admin/users"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-component">组件</FieldLabel>
                      <Input
                        id="create-menu-component"
                        name="component"
                        placeholder="dashboard/admin/users/page"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-icon">图标</FieldLabel>
                      <Input id="create-menu-icon" name="icon" placeholder="menu" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-visible">可见性</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="visible"
                        id="create-menu-visible"
                        name="visible"
                      >
                        <option value="visible">可见</option>
                        <option value="hidden">隐藏</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-status">状态</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="active"
                        id="create-menu-status"
                        name="status"
                      >
                        <option value="active">启用</option>
                        <option value="inactive">停用</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-permission-action">权限动作</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-permission-action"
                        name="permissionAction"
                      >
                        <option value="">无</option>
                        {appActions.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-menu-permission-resource">权限资源</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue=""
                        id="create-menu-permission-resource"
                        name="permissionResource"
                      >
                        <option value="">无</option>
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
                    <Button type="submit">创建菜单</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardDescription>筛选</CardDescription>
            <CardTitle>导航切片</CardTitle>
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
                <FieldLabel htmlFor="search">搜索</FieldLabel>
                <Input
                  defaultValue={filters.search}
                  id="search"
                  name="search"
                  placeholder="搜索菜单名称或路径"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="status">状态</FieldLabel>
                <select
                  className={selectClassName}
                  defaultValue={filters.status}
                  id="status"
                  name="status"
                >
                  <option value="all">全部状态</option>
                  <option value="active">仅启用</option>
                  <option value="inactive">仅停用</option>
                </select>
              </Field>

              <Field>
                <FieldLabel htmlFor="visible">可见性</FieldLabel>
                <select
                  className={selectClassName}
                  defaultValue={filters.visible}
                  id="visible"
                  name="visible"
                >
                  <option value="all">全部可见性</option>
                  <option value="visible">仅可见</option>
                  <option value="hidden">仅隐藏</option>
                </select>
              </Field>

              <div className="flex items-end gap-3">
                <Link
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                  href="/dashboard/admin/menus"
                >
                  重置
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>导航表格</CardDescription>
            <CardTitle>菜单注册表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>菜单</TableHead>
                    <TableHead>路径</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    {canWriteMenus ? <TableHead className="text-right">操作</TableHead> : null}
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
                          {row.path ?? '无路径'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.permissionAction && row.permissionResource
                            ? `${row.permissionAction}:${row.permissionResource}`
                            : '公共壳层'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={row.visible ? 'secondary' : 'outline'}>
                              {row.visible ? '可见' : '隐藏'}
                            </Badge>
                            <Badge variant={row.status ? 'outline' : 'secondary'}>
                              {row.status ? '启用' : '停用'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                        {canWriteMenus ? (
                          <TableCell className="text-right">
                            {protectedMenu ? (
                              <Badge variant="outline">种子菜单</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <ManagementDialog
                                  contentClassName="sm:max-w-5xl"
                                  description="更新菜单路径、权限绑定和层级关系。"
                                  title={`编辑 ${row.name}`}
                                  triggerLabel="编辑"
                                  triggerSize="sm"
                                  triggerVariant="outline"
                                >
                                  <form
                                    action={updateMenuAction}
                                    aria-label={`编辑 ${row.name}`}
                                    className="grid gap-4"
                                  >
                                    <input name="id" type="hidden" value={row.id} />
                                    <input name="returnTo" type="hidden" value={returnTo} />
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-name-${row.id}`}>
                                          名称
                                        </FieldLabel>
                                        <Input
                                          defaultValue={row.name}
                                          id={`update-menu-name-${row.id}`}
                                          name="name"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-type-${row.id}`}>
                                          类型
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
                                          父级目录
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.parentId ?? ''}
                                          id={`update-menu-parent-${row.id}`}
                                          name="parentId"
                                        >
                                          <option value="">顶级</option>
                                          {editDirectoryOptions.map((menuEntry) => (
                                            <option key={menuEntry.id} value={menuEntry.id}>
                                              {menuEntry.name}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-sort-${row.id}`}>
                                          排序
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
                                          路径
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.path)}
                                          id={`update-menu-path-${row.id}`}
                                          name="path"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-component-${row.id}`}>
                                          组件
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.component)}
                                          id={`update-menu-component-${row.id}`}
                                          name="component"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-icon-${row.id}`}>
                                          图标
                                        </FieldLabel>
                                        <Input
                                          defaultValue={stringifyNullableValue(row.icon)}
                                          id={`update-menu-icon-${row.id}`}
                                          name="icon"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-visible-${row.id}`}>
                                          可见性
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.visible ? 'visible' : 'hidden'}
                                          id={`update-menu-visible-${row.id}`}
                                          name="visible"
                                        >
                                          <option value="visible">可见</option>
                                          <option value="hidden">隐藏</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-status-${row.id}`}>
                                          状态
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.status ? 'active' : 'inactive'}
                                          id={`update-menu-status-${row.id}`}
                                          name="status"
                                        >
                                          <option value="active">启用</option>
                                          <option value="inactive">停用</option>
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-action-${row.id}`}>
                                          权限动作
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.permissionAction ?? ''}
                                          id={`update-menu-action-${row.id}`}
                                          name="permissionAction"
                                        >
                                          <option value="">无</option>
                                          {appActions.map((action) => (
                                            <option key={action} value={action}>
                                              {action}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`update-menu-resource-${row.id}`}>
                                          权限资源
                                        </FieldLabel>
                                        <select
                                          className={selectClassName}
                                          defaultValue={row.permissionResource ?? ''}
                                          id={`update-menu-resource-${row.id}`}
                                          name="permissionResource"
                                        >
                                          <option value="">无</option>
                                          {appSubjects.map((subject) => (
                                            <option key={subject} value={subject}>
                                              {subject}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                      <Button type="submit">保存变更</Button>
                                    </div>
                                  </form>
                                </ManagementDialog>
                                <DestructiveActionDialog
                                  action={deleteMenuAction}
                                  confirmLabel="删除菜单"
                                  consequences="删除菜单会影响导航拓扑，并可能让关联入口立即消失。"
                                  description="确认后将永久删除该自定义菜单节点。"
                                  hiddenFields={[
                                    { name: 'id', value: row.id },
                                    { name: 'returnTo', value: returnTo },
                                  ]}
                                  title={`删除 ${row.name}？`}
                                  triggerLabel="删除"
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
