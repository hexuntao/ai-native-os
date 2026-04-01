import {
  Badge,
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

import { DataSurfacePage } from '@/components/management/data-surface-page'
import { PaginationControls } from '@/components/management/pagination-controls'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createKnowledgeFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadKnowledgeList } from '@/lib/server-management'

interface KnowledgePageProps {
  searchParams: Promise<DashboardSearchParams>
}

export default async function AiKnowledgePage({
  searchParams,
}: KnowledgePageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createKnowledgeFilterState(resolvedSearchParams)
  const payload = await loadKnowledgeList(filters)

  return (
    <DataSurfacePage
      description="RAG document inventory sourced from the pgvector-backed knowledge contract. This surface summarizes documents, not raw chunks, so operators can inspect coverage quickly."
      eyebrow="AI Module"
      facts={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All titles and content',
        },
        {
          label: 'Source type',
          value: filters.sourceType ?? 'All sources',
        },
      ]}
      metrics={[
        {
          detail: 'Total knowledge documents currently indexed.',
          label: 'Documents',
          value: formatCount(payload.pagination.total),
        },
        {
          detail: 'Chunk rows represented in the current page slice.',
          label: 'Chunks',
          value: formatCount(payload.data.reduce((sum, row) => sum + row.chunkCount, 0)),
        },
        {
          detail: 'Distinct source types visible in the current page slice.',
          label: 'Source classes',
          value: formatCount(new Set(payload.data.map((row) => row.sourceType)).size),
        },
      ]}
      title="Knowledge Vault"
    >
      <form
        action="/ai/knowledge"
        className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
        method="GET"
      >
        <input name="page" type="hidden" value="1" />
        <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

        <Field>
          <FieldLabel htmlFor="search">Search</FieldLabel>
          <Input
            defaultValue={filters.search}
            id="search"
            name="search"
            placeholder="Search title or content"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="sourceType">Source type</FieldLabel>
          <Input
            defaultValue={filters.sourceType}
            id="sourceType"
            name="sourceType"
            placeholder="doc / markdown / policy"
          />
        </Field>

        <div className="flex items-end gap-3">
          <a
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
            href="/ai/knowledge"
          >
            Reset
          </a>
        </div>
      </form>

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>URI</TableHead>
              <TableHead>Indexed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payload.data.map((row) => (
              <TableRow key={row.documentId}>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium">{row.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {Object.entries(row.metadata)
                        .slice(0, 2)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(' · ') || 'No metadata'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.sourceType}</Badge>
                </TableCell>
                <TableCell className="font-medium">{formatCount(row.chunkCount)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.sourceUri ?? 'internal'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.lastIndexedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
        <FieldLabel>Retrieval note</FieldLabel>
        <FieldHint>
          Semantic preview and re-index triggers stay out of this phase because they would introduce
          write paths and tool execution from the UI.
        </FieldHint>
      </Field>

      <PaginationControls
        nextHref={
          payload.pagination.page < payload.pagination.totalPages
            ? createDashboardHref('/ai/knowledge', resolvedSearchParams, {
                page: String(payload.pagination.page + 1),
              })
            : undefined
        }
        page={payload.pagination.page}
        pageSize={payload.pagination.pageSize}
        previousHref={
          payload.pagination.page > 1
            ? createDashboardHref('/ai/knowledge', resolvedSearchParams, {
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
