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
    title: '知识集合',
    sections: [
      {
        title: '页面用途',
        description: '在同一个上下文工程工作面中查看已索引文档、来源覆盖和检索占用。',
      },
      {
        title: '操作边界',
        description: '这个页面聚焦文档级检索态势。语义搜索行为和下游代理使用仍依赖共享运行时索引。',
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
      pageTitle="知识集合"
      pageDescription="带来源筛选、元数据覆盖与检索占用信息的已索引文档注册表。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        {flashMessage ? (
          <PageFlashBanner kind={flashMessage.kind} message={flashMessage.message} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="已索引"
            detail="当前筛选切片中可见的文档数量。"
            label="文档"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={`${sourceClassCount} 种来源类型`}
            detail="当前页面切片中代表的总 chunk 数量。"
            label="分块"
            value={formatCount(totalChunks)}
          />
          <MetricCard
            badge="覆盖率"
            detail="元数据不为空的文档数量。"
            label="元数据覆盖"
            value={`${metadataCoverageCount}/${payload.data.length}`}
            variant={metadataCoverageCount > 0 ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="重建索引成本"
            detail="当前页面切片中按 chunk 数量计算的最大文档。"
            label="最大文档"
            value={formatCount(largestChunkCount)}
            variant={largestChunkCount > 150 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>筛选</CardDescription>
                <CardTitle>知识切片</CardTitle>
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
                    <FieldLabel htmlFor="search">搜索</FieldLabel>
                    <Input
                      defaultValue={filters.search}
                      id="search"
                      name="search"
                      placeholder="搜索标题或正文"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="sourceType">来源类型</FieldLabel>
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
                      重置
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>文档注册表</CardDescription>
                <CardTitle>可见知识文档</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payload.data.length === 0 ? (
                  <div className="text-muted-foreground p-6 text-sm leading-7">
                    当前筛选下没有可见知识文档。
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>文档</TableHead>
                            <TableHead>来源</TableHead>
                            <TableHead>分块</TableHead>
                            <TableHead>URI</TableHead>
                            <TableHead>索引时间</TableHead>
                            {canWriteKnowledge ? (
                              <TableHead className="text-right">操作</TableHead>
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
                                      .join(' · ') || '无元数据'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{row.sourceType}</Badge>
                              </TableCell>
                              <TableCell>{formatCount(row.chunkCount)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.sourceUri ?? '内部'}
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
                <CardDescription>操作入口</CardDescription>
                <CardTitle>写入工作流</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7">
                <p>
                  写入模式:{' '}
                  <Badge variant={canWriteKnowledge ? 'secondary' : 'outline'}>
                    {canWriteKnowledge ? '可写' : '只读'}
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
                <CardDescription>检索说明</CardDescription>
                <CardTitle>来源态势</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7">
                <p>
                  当前切片中的不同来源类型: <strong>{formatCount(sourceClassCount)}</strong>
                </p>
                <p className="text-muted-foreground">
                  用元数据覆盖率和分块集中度判断，下一步应该做清理、重建索引，还是改 Prompt
                  侧上下文。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
