import {
  Badge,
  Field,
  FieldHint,
  FieldLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { DataSurfacePage } from '@/components/management/data-surface-page'
import { PaginationControls } from '@/components/management/pagination-controls'
import { formatCount } from '@/lib/format'
import {
  createDashboardHref,
  createToggleFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiEvalsList } from '@/lib/server-management'

interface EvalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function AiEvalsPage({ searchParams }: EvalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createToggleFilterState(resolvedSearchParams, 'noop')
  const payload = await loadAiEvalsList(filters)

  return (
    <DataSurfacePage
      description="Mastra eval suites with persisted run summaries. Data here reflects real dataset registration and stored experiment outcomes."
      eyebrow="AI Module"
      facts={[
        {
          label: 'Configured',
          value: payload.summary.configured ? 'yes' : 'no',
        },
        {
          label: 'Reason',
          value: payload.summary.reason,
        },
      ]}
      metrics={[
        {
          detail: 'Datasets currently registered for eval suites.',
          label: 'Datasets',
          value: formatCount(payload.summary.totalDatasets),
        },
        {
          detail: 'Persisted experiments recorded from eval runners.',
          label: 'Experiments',
          value: formatCount(payload.summary.totalExperiments),
        },
        {
          detail: 'Rows returned in the current contract-first page.',
          label: 'Rows',
          value: formatCount(payload.data.length),
        },
      ]}
      title="Eval Registry"
    >
      <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
        <FieldLabel>Evaluation state</FieldLabel>
        <FieldHint>
          Evaluations are backed by Mastra datasets, deterministic scorers, and persisted run
          records for traceability.
        </FieldHint>
      </Field>

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
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
            {payload.data.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={6}>
                  No eval suites are registered yet.
                </TableCell>
              </TableRow>
            ) : (
              payload.data.map((row) => (
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
                      ? `${row.lastRunAt} (${row.lastRunStatus ?? 'unknown'})`
                      : 'never'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </DataSurfacePage>
  )
}
