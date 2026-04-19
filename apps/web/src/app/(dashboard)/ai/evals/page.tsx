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

import { AssistantHandoffCard, SurfaceStatePanel } from '@/components/management/page-feedback'
import { PaginationControls } from '@/components/management/pagination-controls'
import { ResponsiveTableRegion } from '@/components/management/responsive-table-region'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiEvalsList } from '@/lib/server-management'

interface EvalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

interface EvalRiskRow {
  detail: string
  id: string
  label: string
  tone: 'critical' | 'neutral' | 'warning'
}

/**
 * 统计当前 eval 切片中从未运行过的套件数量，帮助区分“已登记”和“已验证”。
 */
function countNeverRunRows(lastRunValues: ReadonlyArray<string | null>): number {
  return lastRunValues.filter((value) => value === null).length
}

/**
 * 统计当前切片里最近一次执行失败的 eval 套件数量。
 */
function countFailedRuns(statuses: ReadonlyArray<string | null>): number {
  return statuses.filter((status) => status === 'failed').length
}

/**
 * 为当前页切片提炼最值得优先排查的 eval 套件，优先级按 failed -> never-run -> low-score 排序。
 */
function createEvalRiskQueue(
  rows: Awaited<ReturnType<typeof loadAiEvalsList>>['data'],
): EvalRiskRow[] {
  return rows
    .map((row) => {
      if (row.lastRunStatus === 'failed') {
        return {
          detail: '最近一次运行失败，优先检查 runner、dataset 或 scorer 漂移。',
          id: row.id,
          label: row.name,
          tone: 'critical' as const,
        }
      }

      if (row.lastRunAt === null) {
        return {
          detail: '已登记但从未运行，当前只是“有套件”而不是“有纪律”。',
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      if ((row.lastRunAverageScore ?? 1) < 0.75) {
        return {
          detail: `最近分数 ${Math.round((row.lastRunAverageScore ?? 0) * 100)}%，建议先看 scorer 和样本覆盖。`,
          id: row.id,
          label: row.name,
          tone: 'warning' as const,
        }
      }

      return {
        detail: '最近一次运行稳定，可作为基线参考。',
        id: row.id,
        label: row.name,
        tone: 'neutral' as const,
      }
    })
    .sort((left, right) => {
      const score = { critical: 0, warning: 1, neutral: 2 }

      return score[left.tone] - score[right.tone]
    })
    .slice(0, 5)
}

export default async function AiEvalsPage({ searchParams }: EvalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadAiEvalsList(filters)
  const neverRunCount = countNeverRunRows(payload.data.map((row) => row.lastRunAt))
  const failedRunCount = countFailedRuns(payload.data.map((row) => row.lastRunStatus ?? null))
  const averageScoreRows = payload.data.filter((row) => row.lastRunAverageScore !== null)
  const evalRiskQueue = createEvalRiskQueue(payload.data)
  const recentRuns = [...payload.data]
    .filter((row) => row.lastRunAt !== null)
    .sort((left, right) => {
      const leftTimestamp = new Date(left.lastRunAt ?? 0).getTime()
      const rightTimestamp = new Date(right.lastRunAt ?? 0).getTime()

      return rightTimestamp - leftTimestamp
    })
    .slice(0, 5)
  const assistantHandoff = resolveCopilotPageHandoff('/ai/evals')

  return (
    <StatusWorkbenchPage
      assistantHandoff={
        assistantHandoff ? (
          <AssistantHandoffCard
            badge={assistantHandoff.badge}
            description={assistantHandoff.summary}
            note={assistantHandoff.note}
            prompts={assistantHandoff.prompts}
            title={assistantHandoff.title}
          />
        ) : undefined
      }
      context={[
        {
          label: 'Configured',
          value: payload.summary.configured ? 'yes' : 'no',
        },
        {
          label: 'Reason',
          value: payload.summary.reason,
        },
      ]}
      description="评测页优先回答三件事：当前有没有评测能力、最近跑得怎么样、哪些套件仍然停留在“已登记未验证”。"
      eyebrow="AI Module"
      signals={[
        {
          badge: payload.summary.configured ? 'ready' : 'degraded',
          detail: '当前已注册到评测运行时的数据集总数。',
          label: 'Datasets',
          tone: payload.summary.totalDatasets > 0 ? 'positive' : 'warning',
          value: formatCount(payload.summary.totalDatasets),
        },
        {
          badge: 'persisted',
          detail: '已经持久化保存到数据库的实验执行总数。',
          label: 'Experiments',
          tone: payload.summary.totalExperiments > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.summary.totalExperiments),
        },
        {
          badge: `${payload.data.length} visible`,
          detail: '当前页切片里从未运行过的 eval 套件数量。',
          label: 'Never run',
          tone: neverRunCount === 0 ? 'positive' : 'warning',
          value: formatCount(neverRunCount),
        },
        {
          badge: failedRunCount === 0 ? 'stable' : 'attention',
          detail: '最近一次执行失败的 eval 套件数量，需要优先检查 scorer 或 dataset。 ',
          label: 'Failed last run',
          tone: failedRunCount === 0 ? 'positive' : 'critical',
          value: formatCount(failedRunCount),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Eval strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={payload.summary.configured ? 'accent' : 'secondary'}>
                configured:{payload.summary.configured ? 'yes' : 'no'}
              </Badge>
              <Badge variant={failedRunCount === 0 ? 'secondary' : 'accent'}>
                failed-last-run:{failedRunCount}
              </Badge>
              <Badge variant={neverRunCount === 0 ? 'accent' : 'secondary'}>
                never-run:{neverRunCount}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Evaluation state</p>
            <p className="text-sm leading-6 text-muted-foreground">
              数据来自已注册 dataset、deterministic scorer 和持久化 experiment
              summary，不是演示态统计。
            </p>
          </div>
        </div>
      }
      title="Eval Registry"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
        <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
          <CardHeader className="gap-2 border-b border-border/70">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Suite table
            </p>
            <CardTitle className="text-xl">Registered eval suites</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden p-0">
            {payload.data.length === 0 ? (
              <div className="p-6">
                <SurfaceStatePanel
                  actionHref="/ai/evals"
                  actionLabel="Reset filters"
                  description="当前环境还没有可见的 eval suite。先确认 runtime 是否已配置，再决定是补注册、补 dataset 还是补 scorer。"
                  eyebrow="Eval empty state"
                  hints={[
                    'Configured=no 时，优先排查评测运行时和密钥，而不是要求页面给出不存在的执行结果。',
                    '如果 suite 应该存在，先放宽筛选，再把问题交给助手解释覆盖缺口。',
                  ]}
                  title="No eval suites in this slice"
                  tone="neutral"
                />
              </div>
            ) : (
              <ResponsiveTableRegion label="Eval registry table" minWidthClassName="min-w-[58rem]">
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
                          <Badge variant={row.status === 'registered' ? 'accent' : 'secondary'}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.datasetSize}</TableCell>
                        <TableCell>{row.scorerCount}</TableCell>
                        <TableCell className="font-medium">
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
              </ResponsiveTableRegion>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Risk queue
              </p>
              <CardTitle className="text-xl">What needs review first</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              {evalRiskQueue.map((riskRow) => (
                <div
                  className="grid gap-1 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-3"
                  key={riskRow.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{riskRow.label}</span>
                    <Badge
                      variant={
                        riskRow.tone === 'critical'
                          ? 'outline'
                          : riskRow.tone === 'warning'
                            ? 'secondary'
                            : 'accent'
                      }
                    >
                      {riskRow.tone}
                    </Badge>
                  </div>
                  <p>{riskRow.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Recent timeline
              </p>
              <CardTitle className="text-xl">Latest persisted runs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              {recentRuns.length === 0 ? (
                <p>当前切片还没有任何已持久化运行，先解决 never-run 再谈评分趋势。</p>
              ) : (
                recentRuns.map((row) => (
                  <div
                    className="grid gap-1 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-3"
                    key={row.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{row.name}</span>
                      <Badge variant={row.lastRunStatus === 'failed' ? 'outline' : 'accent'}>
                        {row.lastRunStatus ?? 'unknown'}
                      </Badge>
                    </div>
                    <p>{formatDateTime(row.lastRunAt ?? '')}</p>
                    <p>
                      score:{' '}
                      {row.lastRunAverageScore === null
                        ? 'n/a'
                        : `${Math.round(row.lastRunAverageScore * 100)}%`}
                    </p>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Suites with stored score</span>
                <span className="font-medium text-foreground">{averageScoreRows.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/ai/evals', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/ai/evals', resolvedSearchParams, {
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
