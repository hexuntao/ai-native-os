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

export default async function AiEvalsPage({ searchParams }: EvalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadAiEvalsList(filters)
  const neverRunCount = countNeverRunRows(payload.data.map((row) => row.lastRunAt))
  const failedRunCount = countFailedRuns(payload.data.map((row) => row.lastRunStatus ?? null))
  const averageScoreRows = payload.data.filter((row) => row.lastRunAverageScore !== null)
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
                Score posture
              </p>
              <CardTitle className="text-xl">Recent signal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Suites with stored score</span>
                <span className="font-medium text-foreground">{averageScoreRows.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card/80 px-3 py-2">
                <span>Highest recent score</span>
                <span className="font-medium text-foreground">
                  {averageScoreRows.length === 0
                    ? 'n/a'
                    : `${Math.round(
                        Math.max(...averageScoreRows.map((row) => row.lastRunAverageScore ?? 0)) *
                          100,
                      )}%`}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operator read
              </p>
              <CardTitle className="text-xl">How to read this page</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <p>Configured=yes 只说明 runtime 已接通，不代表所有套件最近都跑过。</p>
              <p>Never run 高说明评测面已经登记，但还没有形成真实回归纪律。</p>
              <p>
                Failed last run 高于 0 时，优先排查最近一轮 scorer、dataset 或 runner 环境漂移。
              </p>
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
