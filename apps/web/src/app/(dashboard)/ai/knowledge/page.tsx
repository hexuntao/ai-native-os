import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldError,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'
import { KnowledgeMutationDialog } from '@/components/ai/knowledge-mutation-dialog'
import { GenerativeKnowledgePanel } from '@/components/generative/generative-knowledge-panel'
import { FilterToolbar } from '@/components/management/filter-toolbar'
import { PaginationControls } from '@/components/management/pagination-controls'
import { StatusWorkbenchPage } from '@/components/management/status-workbench-page'
import { canManageKnowledge } from '@/lib/ability'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createDashboardHref,
  createKnowledgeFilterState,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadKnowledgeList, loadSerializedAbilityPayload } from '@/lib/server-management'

interface KnowledgePageProps {
  searchParams: Promise<DashboardSearchParams>
}

/**
 * 从搜索参数中提取一次性反馈消息，供服务端页面渲染操作结果提示。
 */
function readFlashMessage(searchParams: DashboardSearchParams): {
  kind: 'error' | 'success'
  message: string
} | null {
  const errorValue = searchParams.error
  const successValue = searchParams.success
  const normalizedError = Array.isArray(errorValue) ? errorValue[0] : errorValue
  const normalizedSuccess = Array.isArray(successValue) ? successValue[0] : successValue

  if (normalizedError) {
    return {
      kind: 'error',
      message: normalizedError,
    }
  }

  if (normalizedSuccess) {
    return {
      kind: 'success',
      message: normalizedSuccess,
    }
  }

  return null
}

/**
 * 把当前查询状态回写为 returnTo，确保服务端动作完成后能返回同一筛选上下文。
 */
function createCurrentKnowledgeHref(searchParams: DashboardSearchParams): string {
  return createDashboardHref('/ai/knowledge', searchParams, {
    error: undefined,
    success: undefined,
  })
}

/**
 * 统计当前页切片里 metadata 非空的知识文档数量，帮助快速判断治理完备度。
 */
function countDocumentsWithMetadata(
  rows: ReadonlyArray<{
    metadata: Record<string, string | number | boolean | null>
  }>,
): number {
  return rows.filter((row) => Object.keys(row.metadata).length > 0).length
}

/**
 * 计算当前切片里最大的 chunk 数量，用于快速识别重索引成本更高的文档。
 */
function resolveLargestChunkCount(
  rows: ReadonlyArray<{
    chunkCount: number
  }>,
): number {
  return rows.reduce((maxValue, row) => Math.max(maxValue, row.chunkCount), 0)
}

export default async function AiKnowledgePage({
  searchParams,
}: KnowledgePageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createKnowledgeFilterState(resolvedSearchParams)
  const [payload, abilityPayload] = await Promise.all([
    loadKnowledgeList(filters),
    loadSerializedAbilityPayload(),
  ])
  const flashMessage = readFlashMessage(resolvedSearchParams)
  const returnTo = createCurrentKnowledgeHref(resolvedSearchParams)
  const canWriteKnowledge = abilityPayload ? canManageKnowledge(abilityPayload) : false
  const metadataCoverageCount = countDocumentsWithMetadata(payload.data)
  const largestChunkCount = resolveLargestChunkCount(payload.data)
  const sourceClassCount = new Set(payload.data.map((row) => row.sourceType)).size

  return (
    <StatusWorkbenchPage
      context={[
        {
          label: 'Search scope',
          value: filters.search ?? 'All titles and content',
        },
        {
          label: 'Source type',
          value: filters.sourceType ?? 'All sources',
        },
        {
          label: 'Mutation mode',
          value: canWriteKnowledge ? 'write-enabled' : 'read-only',
        },
      ]}
      description="知识库工作台优先呈现索引覆盖、写入动作和生成式分析，让操作员能在同一页面里完成筛选、重建索引和覆盖判断。"
      eyebrow="AI Module"
      signals={[
        {
          badge: 'indexed',
          detail: '当前筛选条件下命中的知识文档总数。',
          label: 'Documents',
          tone: payload.pagination.total > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.pagination.total),
        },
        {
          badge: `${sourceClassCount} source types`,
          detail: '当前页切片里累计的 chunk 行数，代表检索负载体积。',
          label: 'Chunks',
          tone: payload.data.length > 0 ? 'positive' : 'neutral',
          value: formatCount(payload.data.reduce((sum, row) => sum + row.chunkCount, 0)),
        },
        {
          badge: payload.data.length === 0 ? 'n/a' : 'coverage',
          detail: '当前页切片里 metadata 非空的文档数量，越高代表治理信息越完整。',
          label: 'Metadata coverage',
          tone: metadataCoverageCount > 0 ? 'positive' : 'warning',
          value: `${metadataCoverageCount}/${payload.data.length}`,
        },
        {
          badge: 'reindex cost',
          detail: '当前页中 chunk 数最多的文档，适合优先评估替换索引的成本。',
          label: 'Largest document',
          tone: largestChunkCount > 150 ? 'warning' : 'neutral',
          value: formatCount(largestChunkCount),
        },
      ]}
      statusStrip={
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Knowledge strip
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">search:{filters.search ?? 'all'}</Badge>
              <Badge variant={filters.sourceType ? 'accent' : 'secondary'}>
                source:{filters.sourceType ?? 'all'}
              </Badge>
              <Badge variant={canWriteKnowledge ? 'accent' : 'secondary'}>
                write:{canWriteKnowledge ? 'enabled' : 'disabled'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Retrieval note</p>
            <p className="text-sm leading-6 text-muted-foreground">
              这里管理的是文档级资源；semantic search、Agent 和 workflow 仍然复用同一份索引数据。
            </p>
          </div>
        </div>
      }
      title="Knowledge Vault"
    >
      {flashMessage ? (
        flashMessage.kind === 'error' ? (
          <FieldError>{flashMessage.message}</FieldError>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {flashMessage.message}
          </div>
        )
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.95fr)]">
        <div className="grid gap-4">
          <FilterToolbar
            actionHref="/ai/knowledge"
            pageSize={filters.pageSize}
            resetHref="/ai/knowledge"
            searchDefaultValue={filters.search}
            searchPlaceholder="Search title or content"
          >
            <div className="grid gap-2">
              <label
                className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                htmlFor="sourceType"
              >
                Source type
              </label>
              <input
                className="flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2"
                defaultValue={filters.sourceType}
                id="sourceType"
                name="sourceType"
                placeholder="doc / markdown / policy"
              />
            </div>
          </FilterToolbar>

          <Card className="overflow-hidden border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Document registry
                  </p>
                  <CardTitle className="text-xl">Visible knowledge documents</CardTitle>
                </div>

                {canWriteKnowledge ? (
                  <KnowledgeMutationDialog mode="create" returnTo={returnTo} />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>URI</TableHead>
                    <TableHead>Indexed</TableHead>
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        {canWriteKnowledge ? (
                          <KnowledgeMutationDialog mode="replace" returnTo={returnTo} row={row} />
                        ) : (
                          <Badge variant="secondary">read-only</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="border-border/75 bg-background/82 shadow-[var(--shadow-soft)]">
            <CardHeader className="gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operator actions
              </p>
              <CardTitle className="text-xl">Write workflow</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              {canWriteKnowledge ? (
                <>
                  <p>创建和替换都要求提交完整正文；系统不会从旧 chunk 反推原文。</p>
                  <p>优先查看 largest document 和 metadata coverage，再决定是否立即重建索引。</p>
                  <p>替换索引入口已经收进每行动作里，避免长表单持续挤占主工作区。</p>
                </>
              ) : (
                <>
                  <p>当前主体只有知识库读取权限，因此不会暴露创建、替换或删除动作。</p>
                  <p>你仍然可以利用右侧生成式摘要观察来源分布和索引覆盖情况。</p>
                </>
              )}
            </CardContent>
          </Card>

          <GenerativeKnowledgePanel rows={payload.data} />
        </div>
      </div>

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
    </StatusWorkbenchPage>
  )
}
