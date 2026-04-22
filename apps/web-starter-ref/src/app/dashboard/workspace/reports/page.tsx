import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ReadBoundaryCard } from '@/components/control-plane/read-boundary-card'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { loadReportWorkspace, loadServerSummary } from '@/lib/server-ai-management'

function createInfoContent(): InfobarContent {
  return {
    title: '报表工作区',
    sections: [
      {
        title: '何时使用本页',
        description: '先检查调度健康，再查看导出历史；当报表流水线陈旧或降级时，再进入工作流追踪。',
        links: [
          {
            title: '打开报表工作流追踪',
            url: '/dashboard/observe/runs?toolId=workflow%3Areport-schedule',
          },
          {
            title: '打开报表评测态势',
            url: '/dashboard/improve/evals?search=report-schedule',
          },
        ],
      },
      {
        title: '助手边界',
        description:
          '助手可以解释调度缺口、导出失败与快照缺失，但这个 Starter 控制台仍将报表执行保持为只读。',
      },
    ],
  }
}

function resolveStatusBadgeVariant(
  status: 'error' | 'forbidden' | 'success',
): 'default' | 'destructive' | 'secondary' {
  if (status === 'success') {
    return 'default'
  }

  if (status === 'error') {
    return 'destructive'
  }

  return 'secondary'
}

export default async function WorkspaceReportsPage(): Promise<ReactNode> {
  const [serverSummary, reportWorkspace] = await Promise.all([
    loadServerSummary(),
    loadReportWorkspace(),
  ])

  const latestSnapshotHref = reportWorkspace.latestExport
    ? (`/dashboard/observe/runs?auditId=${reportWorkspace.latestExport.value.id}&toolId=workflow%3Areport-schedule` as Route)
    : ('/dashboard/observe/runs?toolId=workflow%3Areport-schedule' as Route)

  return (
    <PageContainer
      pageTitle="报表工作区"
      pageDescription="聚合报表流水线的调度健康、导出历史与工作流证据。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>报表调度</CardDescription>
              <CardTitle>{reportWorkspace.schedule.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border px-4 py-3">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  调度
                </span>
                <span className="mt-2 block font-medium">
                  {reportWorkspace.schedule.schedule ?? '手动'}
                </span>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  触发器健康
                </span>
                <span className="mt-2 block font-medium">
                  {serverSummary.health.trigger.status}
                </span>
                <p className="text-muted-foreground mt-2">{serverSummary.health.jobs.detail}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>最近运行</CardDescription>
              <CardTitle>
                {reportWorkspace.latestRun
                  ? formatDateTime(reportWorkspace.latestRun.value.createdAt)
                  : '当前没有可见运行'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              {reportWorkspace.latestRun ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={resolveStatusBadgeVariant(reportWorkspace.latestRun.value.status)}
                    >
                      {reportWorkspace.latestRun.value.status === 'success'
                        ? '成功'
                        : reportWorkspace.latestRun.value.status === 'error'
                          ? '错误'
                          : '禁止'}
                    </Badge>
                    <Badge variant="outline">{reportWorkspace.latestRun.label}</Badge>
                  </div>
                  <p>{reportWorkspace.latestRun.value.toolId}</p>
                  <p className="text-muted-foreground">
                    请求 ID：{reportWorkspace.latestRun.value.requestId ?? '未记录'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  当前主体下，报表工作流还没有产生可见的审计记录。
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>最近导出结果</CardDescription>
              <CardTitle>
                {reportWorkspace.latestExport ? reportWorkspace.latestExport.label : '尚无成功记录'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              {reportWorkspace.latestExport ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={resolveStatusBadgeVariant(reportWorkspace.latestExport.value.status)}
                    >
                      {reportWorkspace.latestExport.value.status === 'success'
                        ? '成功'
                        : reportWorkspace.latestExport.value.status === 'error'
                          ? '错误'
                          : '禁止'}
                    </Badge>
                    <Badge variant="secondary">
                      {formatDateTime(reportWorkspace.latestExport.value.createdAt)}
                    </Badge>
                  </div>
                  <p>
                    {reportWorkspace.latestExport.value.action}:
                    {reportWorkspace.latestExport.value.subject}
                  </p>
                  <p className="text-muted-foreground">
                    {reportWorkspace.latestExport.value.errorMessage ??
                      '最近一次导出证据看起来健康。'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  当前还没有可见的成功工作流导出。请先检查调度触发行。
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <Card>
            <CardHeader>
              <CardDescription>导出历史</CardDescription>
              <CardTitle>最近报表证据</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportWorkspace.exportHistory.length === 0 ? (
                <div className="text-muted-foreground p-6 text-sm leading-7">
                  当前还没有可见的报表工作流证据。先检查调度健康，再确认报表审计记录是否真的在写入。
                </div>
              ) : (
                <div className="overflow-x-auto px-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>工具</TableHead>
                        <TableHead>请求</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportWorkspace.exportHistory.map((entry) => (
                        <TableRow key={entry.value.id}>
                          <TableCell>
                            <Link
                              className="underline-offset-4 hover:underline"
                              href={
                                `/dashboard/observe/runs?auditId=${entry.value.id}&toolId=${encodeURIComponent(entry.value.toolId)}` as Route
                              }
                            >
                              {formatDateTime(entry.value.createdAt)}
                            </Link>
                          </TableCell>
                          <TableCell>{entry.label}</TableCell>
                          <TableCell>
                            <Badge variant={resolveStatusBadgeVariant(entry.value.status)}>
                              {entry.value.status === 'success'
                                ? '成功'
                                : entry.value.status === 'error'
                                  ? '错误'
                                  : '禁止'}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.value.toolId}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.value.requestId ?? '未捕获'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>操作入口</CardDescription>
              <CardTitle>下一步入口</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ReadBoundaryCard
                description="只读执行边界"
                links={[
                  {
                    href: '/dashboard/observe/runs?toolId=workflow%3Areport-schedule',
                    label: '打开工作流追踪',
                  },
                ]}
                nextStep="在引入任何写入触发前，先用调度健康和工作流追踪确认报表流水线是否稳定。"
                reason="在这个 starter 壳层里，手动导出仍由后端统一接管，因此报表工作区只暴露证据、快照和工作流下钻。"
                title="这里不暴露手动导出"
              />

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">首要下一步</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  先从最近一次成功导出证据开始；只有当快照陈旧或降级时，再进入工作流追踪。
                </p>
                <div className="mt-4">
                  <Link
                    className="bg-primary text-primary-foreground inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium"
                    href={latestSnapshotHref}
                  >
                    打开最新快照
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">次级下钻入口</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  在标准 dashboard 路由里继续查看调度触发行、工作流执行记录和报表评测态势。
                </p>
                <div className="mt-4 grid gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm"
                    href="/dashboard/observe/runs?toolId=task%3Areport-schedule-trigger"
                  >
                    调度触发追踪
                  </Link>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm"
                    href="/dashboard/improve/evals?search=report-schedule"
                  >
                    报表评测态势
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
