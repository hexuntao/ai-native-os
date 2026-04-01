import type {
  AiKnowledgeChunkInsert,
  AiKnowledgeIndexResult,
  AiKnowledgeMetadata,
  SemanticKnowledgeSearchMatch,
} from '@ai-native-os/shared'
import { and, asc, cosineDistance, eq, sql } from 'drizzle-orm'

import { type Database, db } from '../client'
import { aiKnowledge } from '../schema'

export interface ReplaceKnowledgeDocumentInput {
  chunks: AiKnowledgeChunkInsert[]
  documentId: string
  metadata: AiKnowledgeMetadata
  sourceType: string
  sourceUri: string | null
  title: string
}

export interface SemanticKnowledgeSearchArgs {
  documentId?: string
  limit: number
  queryEmbedding: number[]
  sourceType?: string
}

function buildKnowledgeFilters(args: SemanticKnowledgeSearchArgs): ReturnType<typeof and> {
  const filters = []

  if (args.documentId) {
    filters.push(eq(aiKnowledge.documentId, args.documentId))
  }

  if (args.sourceType) {
    filters.push(eq(aiKnowledge.sourceType, args.sourceType))
  }

  return filters.length > 0 ? and(...filters) : undefined
}

/**
 * 用新的分块结果覆盖某个知识文档的全部向量记录。
 *
 * 这里选择“整文档替换”而不是局部 patch，目的是让 chunk 索引和 embedding 始终保持一致。
 */
export async function replaceKnowledgeDocument(
  input: ReplaceKnowledgeDocumentInput,
  database: Database = db,
): Promise<AiKnowledgeIndexResult> {
  if (input.chunks.length === 0) {
    throw new Error(`Knowledge document ${input.documentId} does not contain any chunks`)
  }

  await database.transaction(async (tx) => {
    await tx.delete(aiKnowledge).where(eq(aiKnowledge.documentId, input.documentId))
    await tx.insert(aiKnowledge).values(
      input.chunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash: chunk.contentHash,
        documentId: input.documentId,
        embedding: chunk.embedding,
        metadata: input.metadata,
        sourceType: input.sourceType,
        sourceUri: input.sourceUri,
        title: input.title,
        tokenCount: chunk.tokenCount,
      })),
    )
  })

  return {
    chunkCount: input.chunks.length,
    documentId: input.documentId,
    sourceType: input.sourceType,
    title: input.title,
  }
}

/**
 * 按文档 ID 列出已索引的知识分块，便于测试和任务验证。
 */
export async function listKnowledgeChunksByDocumentId(
  documentId: string,
  database: Database = db,
): Promise<SemanticKnowledgeSearchMatch[]> {
  const rows = await database
    .select({
      chunkIndex: aiKnowledge.chunkIndex,
      content: aiKnowledge.content,
      createdAt: aiKnowledge.createdAt,
      distance: sql<number>`0`,
      documentId: aiKnowledge.documentId,
      id: aiKnowledge.id,
      metadata: aiKnowledge.metadata,
      sourceType: aiKnowledge.sourceType,
      sourceUri: aiKnowledge.sourceUri,
      title: aiKnowledge.title,
      tokenCount: aiKnowledge.tokenCount,
    })
    .from(aiKnowledge)
    .where(eq(aiKnowledge.documentId, documentId))
    .orderBy(asc(aiKnowledge.chunkIndex))

  return rows.map((row) => ({
    chunkIndex: row.chunkIndex,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    distance: Number(row.distance),
    documentId: row.documentId,
    id: row.id,
    metadata: row.metadata,
    similarity: Math.max(0, 1 - Number(row.distance)),
    sourceType: row.sourceType,
    sourceUri: row.sourceUri,
    title: row.title,
    tokenCount: row.tokenCount,
  }))
}

/**
 * 使用 pgvector 的 cosine distance 执行语义检索。
 */
export async function semanticSearchKnowledge(
  args: SemanticKnowledgeSearchArgs,
  database: Database = db,
): Promise<SemanticKnowledgeSearchMatch[]> {
  const distance = cosineDistance(aiKnowledge.embedding, args.queryEmbedding)
  const rows = await database
    .select({
      chunkIndex: aiKnowledge.chunkIndex,
      content: aiKnowledge.content,
      createdAt: aiKnowledge.createdAt,
      distance,
      documentId: aiKnowledge.documentId,
      id: aiKnowledge.id,
      metadata: aiKnowledge.metadata,
      sourceType: aiKnowledge.sourceType,
      sourceUri: aiKnowledge.sourceUri,
      title: aiKnowledge.title,
      tokenCount: aiKnowledge.tokenCount,
    })
    .from(aiKnowledge)
    .where(buildKnowledgeFilters(args))
    .orderBy(asc(distance), asc(aiKnowledge.chunkIndex))
    .limit(args.limit)

  return rows.map((row) => {
    const numericDistance = Number(row.distance)

    return {
      chunkIndex: row.chunkIndex,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      distance: numericDistance,
      documentId: row.documentId,
      id: row.id,
      metadata: row.metadata,
      similarity: Math.max(0, 1 - numericDistance),
      sourceType: row.sourceType,
      sourceUri: row.sourceUri,
      title: row.title,
      tokenCount: row.tokenCount,
    }
  })
}
