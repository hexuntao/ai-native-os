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
    title: '用户目录',
    sections: [
      {
        title: '页面用途',
        description: '从系统契约中查看已认证主体、角色绑定和当前目录态势。',
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
      pageTitle="用户目录"
      pageDescription="在 Starter 风格管理工作面中查看已认证主体、角色绑定与目录状态。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="directory"
            detail="系统契约返回的主体总数。"
            label="目录规模"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge="visible"
            detail="当前页面切片中可见的行数。"
            label="可见行"
            value={formatCount(payload.data.length)}
          />
          <MetricCard
            badge="roles"
            detail="当前用户工作流可分配的激活角色。"
            label="可分配角色"
            value={formatCount(assignableRoles.length)}
          />
          <MetricCard
            badge={canWriteUsers ? 'write-enabled' : 'read-only'}
            detail="当前操作员是否可以修改目录记录。"
            label="写入模式"
            value={canWriteUsers ? '可写' : '只读'}
            variant={canWriteUsers ? 'secondary' : 'outline'}
          />
        </div>

        {canWriteUsers ? (
          <Card>
            <CardHeader>
              <CardDescription>目录操作</CardDescription>
              <CardTitle>写入工作流</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl text-sm leading-7 text-muted-foreground">
                新建、编辑和删除都走同一套审计安全服务端动作，列表首屏只保留筛选和目录状态。
              </div>
              <ManagementDialog
                description="创建应用用户、Better Auth credential 身份和 RBAC 角色绑定。"
                title="创建用户"
                triggerId="users-create-trigger"
                triggerLabel="新建用户"
              >
                <form action={createUserAction} aria-label="创建用户表单" className="grid gap-4">
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="create-username">用户名</FieldLabel>
                      <Input id="create-username" minLength={3} name="username" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-email">邮箱</FieldLabel>
                      <Input id="create-email" name="email" required type="email" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-nickname">昵称</FieldLabel>
                      <Input id="create-nickname" name="nickname" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-password">密码</FieldLabel>
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
                      <FieldLabel htmlFor="create-status">状态</FieldLabel>
                      <select
                        className={selectClassName}
                        defaultValue="active"
                        id="create-status"
                        name="status"
                      >
                        <option value="active">启用</option>
                        <option value="inactive">停用</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="create-role-codes">角色绑定</FieldLabel>
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
                    <Button type="submit">创建用户</Button>
                  </div>
                </form>
              </ManagementDialog>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardDescription>筛选</CardDescription>
            <CardTitle>用户目录切片</CardTitle>
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
                <FieldLabel htmlFor="search">搜索</FieldLabel>
                <Input
                  defaultValue={filters.search}
                  id="search"
                  name="search"
                  placeholder="搜索用户名或邮箱"
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

              <div className="flex items-end gap-3">
                <Link
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                  href="/dashboard/admin/users"
                >
                  重置
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>目录表格</CardDescription>
            <CardTitle>已认证主体</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    {canWriteUsers ? <TableHead className="text-right">操作</TableHead> : null}
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
                            {row.nickname ?? '无昵称'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.roleCodes.length === 0 ? (
                            <Badge variant="outline">未分配</Badge>
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
                          {row.status ? '启用' : '停用'}
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
                              title={`编辑 ${row.username}`}
                              triggerLabel="编辑"
                              triggerSize="sm"
                              triggerVariant="outline"
                            >
                              <form
                                action={updateUserAction}
                                aria-label={`编辑 ${row.username}`}
                                className="grid gap-4"
                              >
                                <input name="id" type="hidden" value={row.id} />
                                <input name="returnTo" type="hidden" value={returnTo} />
                                <div className="grid gap-4 xl:grid-cols-2">
                                  <Field>
                                    <FieldLabel htmlFor={`update-username-${row.id}`}>
                                      用户名
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
                                    <FieldLabel htmlFor={`update-email-${row.id}`}>邮箱</FieldLabel>
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
                                      昵称
                                    </FieldLabel>
                                    <Input
                                      defaultValue={row.nickname ?? ''}
                                      id={`update-nickname-${row.id}`}
                                      name="nickname"
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-password-${row.id}`}>
                                      重置密码
                                    </FieldLabel>
                                    <Input
                                      id={`update-password-${row.id}`}
                                      minLength={12}
                                      name="password"
                                      placeholder="留空表示保留当前密码"
                                      type="password"
                                    />
                                    <FieldDescription>
                                      留空表示不重置 Better Auth 密码。
                                    </FieldDescription>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-status-${row.id}`}>
                                      状态
                                    </FieldLabel>
                                    <select
                                      className={selectClassName}
                                      defaultValue={row.status ? 'active' : 'inactive'}
                                      id={`update-status-${row.id}`}
                                      name="status"
                                    >
                                      <option value="active">启用</option>
                                      <option value="inactive">停用</option>
                                    </select>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`update-role-codes-${row.id}`}>
                                      角色绑定
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
                                  <Button type="submit">保存变更</Button>
                                </div>
                              </form>
                            </ManagementDialog>
                            <DestructiveActionDialog
                              action={deleteUserAction}
                              confirmLabel="删除用户"
                              consequences="删除会同时移除应用用户和认证绑定，现有会话也会失效。"
                              description="确认后将永久删除该用户。"
                              hiddenFields={[
                                { name: 'id', value: row.id },
                                { name: 'returnTo', value: returnTo },
                              ]}
                              title={`删除 ${row.username}？`}
                              triggerLabel="删除"
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
