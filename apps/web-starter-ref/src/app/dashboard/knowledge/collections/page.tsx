import Link from 'next/link'
import type { ReactNode } from 'react'
import { KnowledgeMutationDialog } from '@/components/ai/knowledge-mutation-dialog'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PageFlashBanner } from '@/components/control-plane/page-flash-banner'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
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
import { canManageKnowledge } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createKnowledgeFilterState,
  type DashboardSearchParams,
  readDashboardFlashMessage,
  readDashboardMutationState,
} from '@/lib/management'
import { loadKnowledgeList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface KnowledgeCollectionsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Knowledge Collections',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect indexed documents, source coverage, and retrieval footprint in a single context-engineering surface.',
      },
      {
        title: 'Operator boundary',
        description:
          'This page focuses on document-level retrieval posture. Semantic search behavior and downstream agent usage still depend on shared runtime indexes.',
      },
    ],
  }
}

function countDocumentsWithMetadata(
  rows: ReadonlyArray<{
    metadata: Record<string, string | number | boolean | null>
  }>,
): number {
  return rows.filter((row) => Object.keys(row.metadata).length > 0).length
}

function resolveLargestChunkCount(
  rows: ReadonlyArray<{
    chunkCount: number
  }>,
): number {
  return rows.reduce((maxValue, row) => Math.max(maxValue, row.chunkCount), 0)
}

function createCurrentKnowledgeHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/dashboard/knowledge/collections', searchParams, {
    error: undefined,
    mutation: undefined,
    success: undefined,
    target: undefined,
  })
}

export default async function KnowledgeCollectionsPage({
  searchParams,
}: KnowledgeCollectionsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createKnowledgeFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadKnowledgeList(filters),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readDashboardFlashMessage(resolvedSearchParams)
  const mutationState = readDashboardMutationState(resolvedSearchParams)
  const canWriteKnowledge = abilityPayload ? canManageKnowledge(abilityPayload) : false
  const metadataCoverageCount = countDocumentsWithMetadata(payload.data)
  const largestChunkCount = resolveLargestChunkCount(payload.data)
  const totalChunks = payload.data.reduce((sum, row) => sum + row.chunkCount, 0)
  const sourceClassCount = new Set(payload.data.map((row) => row.sourceType)).size
  const returnTo = createCurrentKnowledgeHref(resolvedSearchParams)

  return (
    <PageContainer
      pageTitle="Knowledge Collections"
      pageDescription="Indexed document registry with source filters, metadata coverage, and retrieval footprint."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="indexed"
            detail="Documents visible in the current filter slice."
            label="Documents"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={`${sourceClassCount} source types`}
            detail="Total chunk count represented in the current page slice."
            label="Chunks"
            value={formatCount(totalChunks)}
          />
          <MetricCard
            badge="coverage"
            detail="Documents whose metadata is not empty."
            label="Metadata coverage"
            value={`${metadataCoverageCount}/${payload.data.length}`}
            variant={metadataCoverageCount > 0 ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="reindex cost"
            detail="Largest document by chunk count in this page slice."
            label="Largest document"
            value={formatCount(largestChunkCount)}
            variant={largestChunkCount > 150 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Filters</CardDescription>
                <CardTitle>Knowledge slice</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/knowledge/collections"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
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
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/knowledge/collections"
                    >
                      Reset
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Document registry</CardDescription>
                <CardTitle>Visible knowledge documents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payload.data.length === 0 ? (
                  <div className="text-muted-foreground p-6 text-sm leading-7">
                    No knowledge documents are visible under the current filters.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Chunks</TableHead>
                            <TableHead>URI</TableHead>
                            <TableHead>Indexed</TableHead>
                            {canWriteKnowledge ? (
                              <TableHead className="text-right">Actions</TableHead>
                            ) : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payload.data.map((row) => (
                            <TableRow
                              className={
                                mutationState?.targetId === row.documentId
                                  ? 'bg-muted/50 transition-colors'
                                  : undefined
                              }
                              key={row.documentId}
                            >
                              <TableCell>
                                <div className="grid gap-1">
                                  <span className="font-medium">{row.title}</span>
                                  <span className="text-muted-foreground text-xs">
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
                              <TableCell>{formatCount(row.chunkCount)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.sourceUri ?? 'internal'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDateTime(row.lastIndexedAt)}
                              </TableCell>
                              {canWriteKnowledge ? (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <KnowledgeMutationDialog
                                      mode="replace"
                                      returnTo={returnTo}
                                      row={row}
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
                          ? createDashboardHref(
                              '/dashboard/knowledge/collections',
                              resolvedSearchParams,
                              {
                                page: String(payload.pagination.page + 1),
                              },
                            )
                          : undefined
                      }
                      page={payload.pagination.page}
                      pageSize={payload.pagination.pageSize}
                      previousHref={
                        payload.pagination.page > 1
                          ? createDashboardHref(
                              '/dashboard/knowledge/collections',
                              resolvedSearchParams,
                              {
                                page: String(payload.pagination.page - 1),
                              },
                            )
                          : undefined
                      }
                      total={payload.pagination.total}
                      totalPages={payload.pagination.totalPages}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Operator actions</CardDescription>
                <CardTitle>Write workflow</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7">
                <p>
                  Mutation mode:{' '}
                  <Badge variant={canWriteKnowledge ? 'secondary' : 'outline'}>
                    {canWriteKnowledge ? 'write-enabled' : 'read-only'}
                  </Badge>
                </p>
                {canWriteKnowledge ? (
                  <KnowledgeMutationDialog mode="create" returnTo={returnTo} />
                ) : (
                  <p className="text-muted-foreground">
                    当前主体只有读取权限，因此不会显示知识文档创建、替换和删除入口。
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Retrieval note</CardDescription>
                <CardTitle>Source posture</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7">
                <p>
                  Distinct source types in this slice:{' '}
                  <strong>{formatCount(sourceClassCount)}</strong>
                </p>
                <p className="text-muted-foreground">
                  Use metadata coverage and chunk concentration to decide whether the next step is
                  cleanup, reindexing, or prompt-side context changes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
