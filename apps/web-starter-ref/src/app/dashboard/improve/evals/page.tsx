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
    title: 'Eval Registry',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Track whether evaluation discipline exists, which suites are failing, and which registered suites have never been executed.',
      },
      {
        title: 'Operator boundary',
        description:
          'This registry summarizes datasets, scorers, and persisted runs. It does not replace a deeper eval execution console.',
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
          detail: 'Latest run failed. Check runner, dataset, or scorer drift first.',
          id: row.id,
          label: row.name,
          tone: 'critical' as const,
        }
      }

      if (row.lastRunAt === null) {
        return {
          detail: 'Registered but never run. This is catalog coverage, not evaluation discipline.',
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      if ((row.lastRunAverageScore ?? 1) < 0.75) {
        return {
          detail: `Latest score ${Math.round((row.lastRunAverageScore ?? 0) * 100)}%. Review scorer quality and sample coverage.`,
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      return {
        detail: 'Latest run looks stable and can serve as a baseline.',
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
      pageTitle="Eval Registry"
      pageDescription="Registered evaluation suites, run posture, and risk-ranked review queue."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge={payload.summary.configured ? 'ready' : 'degraded'}
            detail="Datasets currently registered to the eval runtime."
            label="Datasets"
            value={formatCount(payload.summary.totalDatasets)}
            variant={payload.summary.totalDatasets > 0 ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="persisted"
            detail="Persisted experiment count."
            label="Experiments"
            value={formatCount(payload.summary.totalExperiments)}
          />
          <MetricCard
            badge={`${payload.data.length} visible`}
            detail="Suites in this slice that have never been executed."
            label="Never run"
            value={formatCount(neverRunCount)}
            variant={neverRunCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={failedRunCount === 0 ? 'stable' : 'attention'}
            detail="Suites whose latest run failed."
            label="Failed last run"
            value={formatCount(failedRunCount)}
            variant={failedRunCount === 0 ? 'outline' : 'destructive'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Suite table</CardDescription>
              <CardTitle>Registered eval suites</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payload.data.length === 0 ? (
                <div className="text-muted-foreground p-6 text-sm leading-7">
                  No eval suites are visible in this slice.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto px-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Eval</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Datasets</TableHead>
                          <TableHead>Scorers</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Last run</TableHead>
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
                                ? 'n/a'
                                : `${Math.round(row.lastRunAverageScore * 100)}%`}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.lastRunAt
                                ? `${formatDateTime(row.lastRunAt)} (${row.lastRunStatus ?? 'unknown'})`
                                : 'never'}
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
                <CardDescription>Risk queue</CardDescription>
                <CardTitle>What needs review first</CardTitle>
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
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Recent timeline</CardDescription>
                <CardTitle>Latest persisted runs</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {recentRuns.length === 0 ? (
                  <p className="text-muted-foreground text-sm leading-7">
                    No persisted eval runs are visible yet.
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
