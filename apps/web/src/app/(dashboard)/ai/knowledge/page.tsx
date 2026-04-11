import {
  Badge,
  Button,
  Field,
  FieldError,
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

import {
  createKnowledgeAction,
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from '@/app/(dashboard)/ai/knowledge/actions'
import { GenerativeKnowledgePanel } from '@/components/generative/generative-knowledge-panel'
import { DataSurfacePage } from '@/components/management/data-surface-page'
import { PaginationControls } from '@/components/management/pagination-controls'
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

const textAreaClassName =
  'min-h-28 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

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
 * 将元数据对象格式化为 JSON 文本，供表单编辑和回显使用。
 */
function stringifyMetadata(metadata: Record<string, string | number | boolean | null>): string {
  return JSON.stringify(metadata, null, 2)
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

  return (
    <DataSurfacePage
      description="RAG document inventory sourced from the pgvector-backed knowledge contract. This surface now supports audited create, replace, and delete flows at document level while keeping indexing semantics explicit."
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
        {
          label: 'Mutation mode',
          value: canWriteKnowledge ? 'write-enabled' : 'read-only',
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
      {flashMessage ? (
        flashMessage.kind === 'error' ? (
          <FieldError>{flashMessage.message}</FieldError>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {flashMessage.message}
          </div>
        )
      ) : null}

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

      {canWriteKnowledge ? (
        <form
          action={createKnowledgeAction}
          className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/75 p-5 shadow-[var(--shadow-soft)]"
        >
          <input name="returnTo" type="hidden" value={returnTo} />
          <div className="grid gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Create knowledge document
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              创建操作会对完整正文执行 chunking、embedding 和整文档索引。这里不会直接写底层 vector
              表。
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="create-knowledge-title">Title</FieldLabel>
              <Input id="create-knowledge-title" name="title" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-knowledge-source-type">Source type</FieldLabel>
              <Input
                defaultValue="manual"
                id="create-knowledge-source-type"
                name="sourceType"
                required
              />
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="create-knowledge-source-uri">Source URI</FieldLabel>
              <Input
                id="create-knowledge-source-uri"
                name="sourceUri"
                placeholder="https://internal.example.com/wiki/finance"
              />
              <FieldHint>没有外部来源时可留空，系统会归一化为 `null`。</FieldHint>
            </Field>
            <Field>
              <FieldLabel htmlFor="create-knowledge-chunk-size">Chunk size</FieldLabel>
              <Input
                defaultValue="512"
                id="create-knowledge-chunk-size"
                name="chunkSize"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-knowledge-chunk-overlap">Chunk overlap</FieldLabel>
              <Input
                defaultValue="64"
                id="create-knowledge-chunk-overlap"
                name="chunkOverlap"
                type="number"
              />
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="create-knowledge-metadata">Metadata (JSON)</FieldLabel>
              <textarea
                className={textAreaClassName}
                defaultValue={'{\n  "category": "finance"\n}'}
                id="create-knowledge-metadata"
                name="metadata"
              />
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="create-knowledge-content">Document content</FieldLabel>
              <textarea
                className={textAreaClassName}
                id="create-knowledge-content"
                name="content"
                placeholder="Paste the full document content here."
                required
              />
              <FieldHint>创建和更新都需要提交完整正文；系统不会自动从旧 chunk 还原原文。</FieldHint>
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="submit">Create document</Button>
          </div>
        </form>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
          当前主体仅具备知识库只读权限，因此页面不会暴露创建、替换或删除写路径。
        </div>
      )}

      <GenerativeKnowledgePanel rows={payload.data} />

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
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <span className="font-medium">{row.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {Object.entries(row.metadata)
                          .slice(0, 2)
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(' · ') || 'No metadata'}
                      </span>
                    </div>

                    {canWriteKnowledge ? (
                      <details className="rounded-[var(--radius-lg)] border border-border/60 bg-background/70 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Replace index for this document
                        </summary>

                        <div className="mt-4 grid gap-4">
                          <form action={updateKnowledgeAction} className="grid gap-4">
                            <input name="id" type="hidden" value={row.documentId} />
                            <input name="returnTo" type="hidden" value={returnTo} />

                            <div className="grid gap-4 xl:grid-cols-2">
                              <Field>
                                <FieldLabel htmlFor={`title-${row.documentId}`}>Title</FieldLabel>
                                <Input
                                  defaultValue={row.title}
                                  id={`title-${row.documentId}`}
                                  name="title"
                                  required
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor={`source-type-${row.documentId}`}>
                                  Source type
                                </FieldLabel>
                                <Input
                                  defaultValue={row.sourceType}
                                  id={`source-type-${row.documentId}`}
                                  name="sourceType"
                                  required
                                />
                              </Field>
                              <Field className="xl:col-span-2">
                                <FieldLabel htmlFor={`source-uri-${row.documentId}`}>
                                  Source URI
                                </FieldLabel>
                                <Input
                                  defaultValue={row.sourceUri ?? ''}
                                  id={`source-uri-${row.documentId}`}
                                  name="sourceUri"
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor={`chunk-size-${row.documentId}`}>
                                  Chunk size
                                </FieldLabel>
                                <Input
                                  defaultValue="512"
                                  id={`chunk-size-${row.documentId}`}
                                  name="chunkSize"
                                  type="number"
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor={`chunk-overlap-${row.documentId}`}>
                                  Chunk overlap
                                </FieldLabel>
                                <Input
                                  defaultValue="64"
                                  id={`chunk-overlap-${row.documentId}`}
                                  name="chunkOverlap"
                                  type="number"
                                />
                              </Field>
                              <Field className="xl:col-span-2">
                                <FieldLabel htmlFor={`metadata-${row.documentId}`}>
                                  Metadata (JSON)
                                </FieldLabel>
                                <textarea
                                  className={textAreaClassName}
                                  defaultValue={stringifyMetadata(row.metadata)}
                                  id={`metadata-${row.documentId}`}
                                  name="metadata"
                                />
                              </Field>
                              <Field className="xl:col-span-2">
                                <FieldLabel htmlFor={`content-${row.documentId}`}>
                                  Replacement content
                                </FieldLabel>
                                <textarea
                                  className={textAreaClassName}
                                  id={`content-${row.documentId}`}
                                  name="content"
                                  placeholder="Paste the full replacement content here."
                                  required
                                />
                                <FieldHint>
                                  更新语义是“整文档重建索引”。系统不会自动回填旧正文，请粘贴完整新内容。
                                </FieldHint>
                              </Field>
                            </div>

                            <div className="flex flex-wrap justify-between gap-3">
                              <Button type="submit">Replace and reindex</Button>
                            </div>
                          </form>

                          <form action={deleteKnowledgeAction} className="flex justify-start">
                            <input name="id" type="hidden" value={row.documentId} />
                            <input name="returnTo" type="hidden" value={returnTo} />
                            <Button
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              type="submit"
                              variant="secondary"
                            >
                              Delete document
                            </Button>
                          </form>
                        </div>
                      </details>
                    ) : null}
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
          当前页面管理的是文档级资源，不是直接执行 semantic search。检索 Tool、Agent 和 workflow
          仍然复用同一份索引数据。
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
