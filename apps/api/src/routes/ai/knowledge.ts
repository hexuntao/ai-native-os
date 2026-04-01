import { aiKnowledge, db } from '@ai-native-os/db'
import {
  type KnowledgeListResponse,
  knowledgeListResponseSchema,
  type ListKnowledgeInput,
  listKnowledgeInputSchema,
} from '@ai-native-os/shared'
import { and, desc, eq, ilike, or } from 'drizzle-orm'

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

/**
 * 把按 chunk 存储的知识记录聚合成文档摘要，供管理页和列表页消费。
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
 * 提供知识库管理页的文档级摘要列表。
 */
export const aiKnowledgeListProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'AiKnowledge' },
])
  .route({
    method: 'GET',
    path: '/api/v1/ai/knowledge',
    tags: ['AI:Knowledge'],
    summary: 'List indexed knowledge documents',
    description: 'Aggregates chunk-based pgvector rows into document summaries for admin views.',
  })
  .input(listKnowledgeInputSchema)
  .output(knowledgeListResponseSchema)
  .handler(async ({ input }) => listKnowledge(input))
