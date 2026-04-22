import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PagePagination } from '@/components/control-plane/page-pagination'
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
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiEvalsList } from '@/lib/server-management'

interface ImproveEvalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

interface EvalRiskRow {
  detail: string
  id: string
  label: string
  tone: 'critical' | 'neutral' | 'warning'
}

function createInfoContent(): InfobarContent {
  return {
    title: '评测注册表',
    sections: [
      {
        title: '页面用途',
        description: '跟踪评测纪律是否存在、哪些套件正在失败，以及哪些已注册套件从未被执行过。',
      },
      {
        title: '操作边界',
        description: '这个注册表汇总数据集、评分器和持久化运行，但不能替代更深入的评测执行控制台。',
      },
    ],
  }
}

function countNeverRunRows(lastRunValues: ReadonlyArray<string | null>): number {
  return lastRunValues.filter((value) => value === null).length
}

function countFailedRuns(statuses: ReadonlyArray<string | null>): number {
  return statuses.filter((status) => status === 'failed').length
}

function createEvalRiskQueue(
  rows: Awaited<ReturnType<typeof loadAiEvalsList>>['data'],
): EvalRiskRow[] {
  return rows
    .map((row) => {
      if (row.lastRunStatus === 'failed') {
        return {
          detail: '最近一次运行失败。优先检查 runner、数据集或评分器漂移。',
          id: row.id,
          label: row.name,
          tone: 'critical' as const,
        }
      }

      if (row.lastRunAt === null) {
        return {
          detail: '已经注册但从未运行。这只是目录覆盖，不代表已经形成评测纪律。',
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      if ((row.lastRunAverageScore ?? 1) < 0.75) {
        return {
          detail: `最近得分 ${Math.round((row.lastRunAverageScore ?? 0) * 100)}%。请复核评分器质量与样本覆盖。`,
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      return {
        detail: '最近一次运行看起来稳定，可以作为基线。',
        id: row.id,
        label: row.name,
        tone: 'neutral' as const,
      }
    })
    .toSorted((left, right) => {
      const score = { critical: 0, warning: 1, neutral: 2 }

      return score[left.tone] - score[right.tone]
    })
    .slice(0, 5)
}

export default async function ImproveEvalsPage({
  searchParams,
}: ImproveEvalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadAiEvalsList(filters)
  const neverRunCount = countNeverRunRows(payload.data.map((row) => row.lastRunAt))
  const failedRunCount = countFailedRuns(payload.data.map((row) => row.lastRunStatus ?? null))
  const evalRiskQueue = createEvalRiskQueue(payload.data)
  const recentRuns = [...payload.data]
    .filter((row) => row.lastRunAt !== null)
    .toSorted((left, right) => {
      const leftTimestamp = new Date(left.lastRunAt ?? 0).getTime()
      const rightTimestamp = new Date(right.lastRunAt ?? 0).getTime()

      return rightTimestamp - leftTimestamp
    })
    .slice(0, 5)

  return (
    <PageContainer
      pageTitle="评测注册表"
      pageDescription="已注册评测套件、运行态势与按风险排序的复核队列。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge={payload.summary.configured ? 'ready' : 'degraded'}
            detail="当前已注册到评测运行时的数据集数量。"
            label="数据集"
            value={formatCount(payload.summary.totalDatasets)}
            variant={payload.summary.totalDatasets > 0 ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="persisted"
            detail="已持久化的实验数量。"
            label="实验"
            value={formatCount(payload.summary.totalExperiments)}
          />
          <MetricCard
            badge={`${payload.data.length} visible`}
            detail="当前切片中从未执行过的套件数量。"
            label="从未运行"
            value={formatCount(neverRunCount)}
            variant={neverRunCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={failedRunCount === 0 ? 'stable' : 'attention'}
            detail="最近一次运行失败的套件数量。"
            label="最近失败"
            value={formatCount(failedRunCount)}
            variant={failedRunCount === 0 ? 'outline' : 'destructive'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <Card>
            <CardHeader>
              <CardDescription>套件表格</CardDescription>
              <CardTitle>已注册评测套件</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payload.data.length === 0 ? (
                <div className="text-muted-foreground p-6 text-sm leading-7">
                  当前切片中没有可见的评测套件。
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto px-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>评测</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>数据集</TableHead>
                          <TableHead>评分器</TableHead>
                          <TableHead>得分</TableHead>
                          <TableHead>最近运行</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payload.data.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={row.status === 'registered' ? 'secondary' : 'outline'}
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.datasetSize}</TableCell>
                            <TableCell>{row.scorerCount}</TableCell>
                            <TableCell>
                              {row.lastRunAverageScore === null
                                ? '暂无'
                                : `${Math.round(row.lastRunAverageScore * 100)}%`}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.lastRunAt
                                ? `${formatDateTime(row.lastRunAt)} (${row.lastRunStatus ?? '未知'})`
                                : '从未运行'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PagePagination
                    nextHref={
                      payload.pagination.page < payload.pagination.totalPages
                        ? createDashboardHref('/dashboard/improve/evals', resolvedSearchParams, {
                            page: String(payload.pagination.page + 1),
                          })
                        : undefined
                    }
                    page={payload.pagination.page}
                    pageSize={payload.pagination.pageSize}
                    previousHref={
                      payload.pagination.page > 1
                        ? createDashboardHref('/dashboard/improve/evals', resolvedSearchParams, {
                            page: String(payload.pagination.page - 1),
                          })
                        : undefined
                    }
                    total={payload.pagination.total}
                    totalPages={payload.pagination.totalPages}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>风险队列</CardDescription>
                <CardTitle>优先复核什么</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {evalRiskQueue.map((riskRow) => (
                  <div className="rounded-lg border p-4 text-sm leading-6" key={riskRow.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{riskRow.label}</span>
                      <Badge
                        variant={
                          riskRow.tone === 'critical'
                            ? 'destructive'
                            : riskRow.tone === 'warning'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {riskRow.tone}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2">{riskRow.detail}</p>
                    <div className="mt-3 flex gap-2">
                      <Link
                        className="text-primary text-xs underline-offset-4 hover:underline"
                        href={
                          createDashboardHref(
                            '/dashboard/build/prompts',
                            {},
                            {
                              search: riskRow.label,
                            },
                          ) as Route
                        }
                      >
                        打开 Prompt 复核
                      </Link>
                      <Link
                        className="text-primary text-xs underline-offset-4 hover:underline"
                        href={
                          createDashboardHref(
                            '/dashboard/govern/approvals',
                            {},
                            {
                              search: riskRow.label,
                            },
                          ) as Route
                        }
                      >
                        打开审批队列
                      </Link>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>最近时间线</CardDescription>
                <CardTitle>最新持久化运行</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {recentRuns.length === 0 ? (
                  <p className="text-muted-foreground text-sm leading-7">
                    当前还没有可见的持久化评测运行。
                  </p>
                ) : (
                  recentRuns.map((row) => (
                    <div className="rounded-lg border p-4 text-sm leading-6" key={row.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant={row.lastRunStatus === 'failed' ? 'destructive' : 'outline'}>
                          {row.lastRunStatus ?? 'unknown'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-2">
                        {formatDateTime(row.lastRunAt ?? '')}
                      </p>
                      <p>
                        score:{' '}
                        {row.lastRunAverageScore === null
                          ? 'n/a'
                          : `${Math.round(row.lastRunAverageScore * 100)}%`}
                      </p>
                      <div className="mt-3">
                        <Link
                          className="text-primary text-xs underline-offset-4 hover:underline"
                          href={
                            createDashboardHref(
                              '/dashboard/build/prompts',
                              {},
                              {
                                search: row.name,
                              },
                            ) as Route
                          }
                        >
                          Trace linked prompt evidence
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
