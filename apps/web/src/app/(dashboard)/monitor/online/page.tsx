import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { FilterToolbar } from '@/components/management/filter-toolbar'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadOnlineUsersList } from '@/lib/server-management'

interface OnlinePageProps {
  searchParams: Promise<DashboardSearchParams>
}

/**
 * 统计当前页切片中即将过期的会话数量，帮助运维优先关注脆弱登录态。
 */
function countSessionsExpiringSoon(expiresAtValues: readonly string[]): number {
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000

  return expiresAtValues.filter((expiresAt) => {
    const delta = new Date(expiresAt).getTime() - now

    return delta > 0 && delta <= twentyFourHours
  }).length
}

export default async function MonitorOnlinePage({
  searchParams,
}: OnlinePageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadOnlineUsersList(filters)
  const mappedUsers = new Set(payload.data.map((row) => row.rbacUserId).filter(Boolean)).size
  const unmappedSessions = payload.data.filter((row) => row.roleCodes.length === 0).length
  const expiringSoonCount = countSessionsExpiringSoon(payload.data.map((row) => row.expiresAt))
  const distinctRoleCount = new Set(payload.data.flatMap((row) => row.roleCodes)).size

  return (
    <StatusWorkbenchPage
      context={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All active sessions',
        },
        {
          label: 'Presence source',
          value: 'Better Auth sessions',
        },
      ]}
      description="在线态页面优先展示当前会话密度、RBAC 映射覆盖率和即将过期的登录态，避免只剩一张会话表。"
      eyebrow="Monitor Module"
      signals={[
        {
          badge: 'active',
          detail: '当前分页与筛选条件下可见的非过期登录会话总数。',
          label: 'Active sessions',
          tone: payload.pagination.total > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.pagination.total),
        },
        {
          badge: `${distinctRoleCount} roles`,
          detail: '当前页切片里成功映射到 RBAC 用户主体的去重用户数。',
          label: 'Mapped users',
          tone: mappedUsers > 0 ? 'positive' : 'warning',
          value: formatCount(mappedUsers),
        },
        {
          badge: unmappedSessions === 0 ? 'clean' : 'needs review',
          detail: '没有任何角色映射的会话意味着身份可见但授权归因不完整。',
          label: 'Unmapped sessions',
          tone: unmappedSessions === 0 ? 'positive' : 'warning',
          value: formatCount(unmappedSessions),
        },
        {
          badge: '24h window',
          detail: '未来 24 小时内即将过期的会话，适合用来观察登录态抖动。',
          label: 'Expiring soon',
          tone: expiringSoonCount === 0 ? 'neutral' : 'warning',
          value: formatCount(expiringSoonCount),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Presence summary
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">source:better-auth</Badge>
              <Badge variant={unmappedSessions === 0 ? 'accent' : 'secondary'}>
                unmapped:{unmappedSessions}
              </Badge>
              <Badge variant={expiringSoonCount === 0 ? 'secondary' : 'accent'}>
                expiring-soon:{expiringSoonCount}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Approximation boundary</p>
            <p className="text-sm leading-6 text-muted-foreground">
              这里不是 heartbeat telemetry，而是基于未过期认证会话推导出来的近似在线态。
            </p>
          </div>
        </div>
      }
      title="Live Sessions"
    >
      <FilterToolbar
        actionHref="/monitor/online"
        pageSize={filters.pageSize}
        resetHref="/monitor/online"
        searchDefaultValue={filters.search}
        searchPlaceholder="Search email or display name"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Presence ledger
            </p>
            <CardTitle className="text-xl">Authenticated session slice</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden p-0">
            <ResponsiveTableRegion label="Live sessions table" minWidthClassName="min-w-[58rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.data.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{row.name}</span>
                          <span className="text-sm text-muted-foreground">{row.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.roleCodes.length === 0 ? (
                            <Badge variant="secondary">unmapped</Badge>
                          ) : (
                            row.roleCodes.map((roleCode) => (
                              <Badge key={roleCode} variant="outline">
                                {roleCode}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.ipAddress ?? 'unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.expiresAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.sessionId.slice(0, 8)}…
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableRegion>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Presence read
              </p>
              <CardTitle className="text-xl">Session interpretation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <p>如果 unmapped sessions 增长，优先检查身份同步和 RBAC 主体桥接。</p>
              <p>如果 expiring soon 很高，通常意味着当前活跃面依赖短生命周期会话。</p>
              <p>这里不表示真实 websocket 心跳，只表示认证平面推导出的近似在线态。</p>
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Current slice
              </p>
              <CardTitle className="text-xl">Quick breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Distinct roles</span>
                <span className="font-medium text-foreground">{distinctRoleCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Current page rows</span>
                <span className="font-medium text-foreground">{payload.data.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Page size</span>
                <span className="font-medium text-foreground">{payload.pagination.pageSize}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/monitor/online', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/monitor/online', resolvedSearchParams, {
                page: String(payload.pagination.page - 1),
              })
            : undefined
        }
        total={payload.pagination.total}
        totalPages={payload.pagination.totalPages}
      />
    </StatusWorkbenchPage>
  )
}
