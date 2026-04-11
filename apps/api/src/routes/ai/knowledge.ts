import { randomUUID } from 'node:crypto'

import {
  aiKnowledge,
  db,
  deleteKnowledgeDocumentById,
  listKnowledgeChunksByDocumentId,
  writeAiAuditLog,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type CreateKnowledgeInput,
  createKnowledgeInputSchema,
  type DeleteKnowledgeInput,
  type DeleteKnowledgeResult,
  deleteKnowledgeInputSchema,
  deleteKnowledgeResultSchema,
  type GetKnowledgeByIdInput,
  getKnowledgeByIdInputSchema,
  type KnowledgeEntry,
  type KnowledgeListResponse,
  knowledgeEntrySchema,
  knowledgeListResponseSchema,
  type ListKnowledgeInput,
  listKnowledgeInputSchema,
  type UpdateKnowledgeInput,
  updateKnowledgeInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { indexKnowledgeDocument } from '@/mastra/rag/indexing'
import { createMastraRequestContextFromAppContext } from '@/mastra/request-context'
import type { AppContext } from '@/orpc/context'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

interface KnowledgeDocumentSummary {
  chunkCount: number
  documentId: string
  lastIndexedAt: string
  metadata: Record<string, string | number | boolean | null>
  sourceType: string
  sourceUri: string | null
  title: string
}

const knowledgeReadPermissions = [
  { action: 'read', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'AiKnowledge' },
] as const

const knowledgeWritePermissions = [
  { action: 'manage', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'all' },
] as const

const knowledgeCrudAuditToolId = 'contract:ai-knowledge'
const knowledgeOperationModule = 'ai_knowledge'

/**
 * 生成 chunk 内容预览，避免详情接口直接回放完整原文。
 */
function createChunkPreview(content: string, maxLength = 180): string {
  const normalizedContent = content.trim()

  if (normalizedContent.length <= maxLength) {
    return normalizedContent
  }

  return `${normalizedContent.slice(0, maxLength)}...`
}

/**
 * 把按 chunk 存储的知识记录聚合成文档摘要，供列表和详情读取复用。
 */
function summarizeKnowledgeRows(
  rows: ReadonlyArray<typeof aiKnowledge.$inferSelect>,
): KnowledgeDocumentSummary[] {
  const documents = new Map<string, KnowledgeDocumentSummary>()

  for (const row of rows) {
    const existingDocument = documents.get(row.documentId)

    if (existingDocument) {
      existingDocument.chunkCount += 1

      if (row.createdAt.toISOString() > existingDocument.lastIndexedAt) {
        existingDocument.lastIndexedAt = row.createdAt.toISOString()
      }

      continue
    }

    documents.set(row.documentId, {
      chunkCount: 1,
      documentId: row.documentId,
      lastIndexedAt: row.createdAt.toISOString(),
      metadata: row.metadata,
      sourceType: row.sourceType,
      sourceUri: row.sourceUri,
      title: row.title,
    })
  }

  return [...documents.values()].sort((left, right) =>
    right.lastIndexedAt.localeCompare(left.lastIndexedAt),
  )
}

/**
 * 读取单个知识文档的全部 chunk 记录，供详情和删除校验复用。
 */
async function loadKnowledgeRowsByDocumentId(
  documentId: string,
): Promise<Array<typeof aiKnowledge.$inferSelect>> {
  return db
    .select()
    .from(aiKnowledge)
    .where(eq(aiKnowledge.documentId, documentId))
    .orderBy(asc(aiKnowledge.chunkIndex))
}

/**
 * 按文档 ID 回读稳定的知识文档详情，避免 API 直接暴露底层 chunk 表结构。
 */
async function loadKnowledgeEntryById(documentId: string): Promise<KnowledgeEntry | null> {
  const rows = await loadKnowledgeRowsByDocumentId(documentId)

  if (rows.length === 0) {
    return null
  }

  const [summary] = summarizeKnowledgeRows(rows)

  if (!summary) {
    return null
  }

  const chunkRows = await listKnowledgeChunksByDocumentId(documentId)

  return {
    chunkCount: summary.chunkCount,
    chunks: chunkRows.map((chunkRow) => ({
      chunkIndex: chunkRow.chunkIndex,
      contentPreview: createChunkPreview(chunkRow.content),
      createdAt: chunkRow.createdAt,
      tokenCount: chunkRow.tokenCount,
    })),
    documentId: summary.documentId,
    lastIndexedAt: summary.lastIndexedAt,
    metadata: summary.metadata,
    sourceType: summary.sourceType,
    sourceUri: summary.sourceUri,
    title: summary.title,
  }
}

/**
 * 提供知识库管理页的文档级摘要列表。
 */
export async function listKnowledge(input: ListKnowledgeInput): Promise<KnowledgeListResponse> {
  const filters = []

  if (input.search) {
    filters.push(
      or(
        ilike(aiKnowledge.title, `%${input.search}%`),
        ilike(aiKnowledge.content, `%${input.search}%`),
      ),
    )
  }

  if (input.sourceType) {
    filters.push(eq(aiKnowledge.sourceType, input.sourceType))
  }

  const rows = await db
    .select()
    .from(aiKnowledge)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(aiKnowledge.createdAt))
  const summaries = summarizeKnowledgeRows(rows)
  const pagedSummaries = paginateArray(summaries, input.page, input.pageSize)

  return {
    data: pagedSummaries,
    pagination: createPagination(input.page, input.pageSize, summaries.length),
  }
}

/**
 * 读取单个知识文档详情，返回文档摘要与 chunk 预览。
 */
export async function getKnowledgeById(input: GetKnowledgeByIdInput): Promise<KnowledgeEntry> {
  const knowledgeEntry = await loadKnowledgeEntryById(input.id)

  if (!knowledgeEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Knowledge document not found',
    })
  }

  return knowledgeEntry
}

/**
 * 创建新的知识文档并立即写入向量索引。
 */
export async function createKnowledgeEntry(
  input: CreateKnowledgeInput,
  context: AppContext,
): Promise<KnowledgeEntry> {
  const documentId = input.documentId ?? randomUUID()
  const existingKnowledgeEntry = await loadKnowledgeEntryById(documentId)

  if (existingKnowledgeEntry) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Knowledge document ${documentId} already exists`,
    })
  }

  await indexKnowledgeDocument({
    input: {
      ...input,
      documentId,
      sourceUri: input.sourceUri ?? null,
    },
    requestContext: createMastraRequestContextFromAppContext(context),
  })

  const knowledgeEntry = await loadKnowledgeEntryById(documentId)

  if (!knowledgeEntry) {
    throw new Error(`Failed to read back created knowledge document ${documentId}`)
  }

  return knowledgeEntry
}

/**
 * 更新知识文档，语义为整文档重建索引而非局部 patch。
 */
export async function updateKnowledgeEntry(
  input: UpdateKnowledgeInput,
  context: AppContext,
): Promise<KnowledgeEntry> {
  const existingKnowledgeEntry = await loadKnowledgeEntryById(input.id)

  if (!existingKnowledgeEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Knowledge document not found',
    })
  }

  await indexKnowledgeDocument({
    input: {
      ...input,
      documentId: input.id,
      sourceUri: input.sourceUri ?? null,
    },
    requestContext: createMastraRequestContextFromAppContext(context),
  })

  const knowledgeEntry = await loadKnowledgeEntryById(input.id)

  if (!knowledgeEntry) {
    throw new Error(`Failed to read back updated knowledge document ${input.id}`)
  }

  return knowledgeEntry
}

/**
 * 删除整份知识文档的全部 chunk，并写入 AI 审计与操作日志。
 */
export async function deleteKnowledgeEntry(
  input: DeleteKnowledgeInput,
  context: AppContext,
): Promise<DeleteKnowledgeResult> {
  const existingKnowledgeEntry = await loadKnowledgeEntryById(input.id)

  if (!existingKnowledgeEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Knowledge document not found',
    })
  }

  try {
    const removedChunkCount = await deleteKnowledgeDocumentById(input.id)

    await writeAiAuditLog({
      action: 'delete',
      actorAuthUserId: context.userId ?? 'unknown-user',
      actorRbacUserId: context.rbacUserId,
      input,
      output: {
        documentId: input.id,
        removedChunkCount,
      },
      requestInfo: {
        requestId: context.requestId,
        sourceType: existingKnowledgeEntry.sourceType,
      },
      roleCodes: context.roleCodes,
      status: 'success',
      subject: 'AiKnowledge',
      toolId: knowledgeCrudAuditToolId,
    })

    await writeOperationLog({
      action: 'delete_document_index',
      detail: `Deleted knowledge document ${existingKnowledgeEntry.title}.`,
      fallbackActorKind: 'anonymous',
      module: knowledgeOperationModule,
      operatorId: context.rbacUserId,
      requestInfo: {
        requestId: context.requestId,
        sourceType: existingKnowledgeEntry.sourceType,
        sourceUri: existingKnowledgeEntry.sourceUri ?? 'internal',
      },
      targetId: input.id,
    })

    return {
      deleted: true,
      id: input.id,
      removedChunkCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await writeAiAuditLog({
      action: 'delete',
      actorAuthUserId: context.userId ?? 'unknown-user',
      actorRbacUserId: context.rbacUserId,
      errorMessage: message,
      input,
      requestInfo: {
        requestId: context.requestId,
        sourceType: existingKnowledgeEntry.sourceType,
      },
      roleCodes: context.roleCodes,
      status: 'error',
      subject: 'AiKnowledge',
      toolId: knowledgeCrudAuditToolId,
    })

    try {
      await writeOperationLog({
        action: 'delete_document_index',
        detail: `Failed to delete knowledge document ${existingKnowledgeEntry.title}.`,
        errorMessage: message,
        fallbackActorKind: 'anonymous',
        module: knowledgeOperationModule,
        operatorId: context.rbacUserId,
        requestInfo: {
          requestId: context.requestId,
          sourceType: existingKnowledgeEntry.sourceType,
          sourceUri: existingKnowledgeEntry.sourceUri ?? 'internal',
        },
        status: 'error',
        targetId: input.id,
      })
    } catch (operationLogError) {
      const operationLogMessage =
        operationLogError instanceof Error ? operationLogError.message : String(operationLogError)

      console.error(`Failed to persist knowledge delete operation log: ${operationLogMessage}`)
    }

    throw error
  }
}

export const aiKnowledgeListProcedure = requireAnyPermission(knowledgeReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/knowledge',
    tags: ['AI:Knowledge'],
    summary: '分页查询知识库文档',
    description: '按文档维度聚合 pgvector chunk 记录，返回 AI 知识库管理页使用的知识摘要列表。',
  })
  .input(listKnowledgeInputSchema)
  .output(knowledgeListResponseSchema)
  .handler(async ({ input }) => listKnowledge(input))

export const aiKnowledgeGetByIdProcedure = requireAnyPermission(knowledgeReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/knowledge/:id',
    tags: ['AI:Knowledge'],
    summary: '读取单个知识文档详情',
    description: '返回单个知识文档的文档级摘要和 chunk 预览，不直接回放完整原始正文。',
  })
  .input(getKnowledgeByIdInputSchema)
  .output(knowledgeEntrySchema)
  .handler(async ({ input }) => getKnowledgeById(input))

export const aiKnowledgeCreateProcedure = requireAnyPermission(knowledgeWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/knowledge',
    tags: ['AI:Knowledge'],
    summary: '创建知识文档并建立索引',
    description: '接收完整知识正文并立即执行 chunking、embedding 和向量索引写入。',
  })
  .input(createKnowledgeInputSchema)
  .output(knowledgeEntrySchema)
  .handler(async ({ context, input }) => createKnowledgeEntry(input, context))

export const aiKnowledgeUpdateProcedure = requireAnyPermission(knowledgeWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/ai/knowledge/:id',
    tags: ['AI:Knowledge'],
    summary: '重建单个知识文档索引',
    description: '用新的完整正文替换现有知识文档，并重建该文档全部 chunk 与 embedding。',
  })
  .input(updateKnowledgeInputSchema)
  .output(knowledgeEntrySchema)
  .handler(async ({ context, input }) => updateKnowledgeEntry(input, context))

export const aiKnowledgeDeleteProcedure = requireAnyPermission(knowledgeWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/ai/knowledge/:id',
    tags: ['AI:Knowledge'],
    summary: '删除单个知识文档',
    description: '删除该知识文档下的全部 chunk 记录，并同步写入 AI 审计与操作日志。',
  })
  .input(deleteKnowledgeInputSchema)
  .output(deleteKnowledgeResultSchema)
  .handler(async ({ context, input }) => deleteKnowledgeEntry(input, context))
