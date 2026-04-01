import { z } from 'zod'

const aiKnowledgeMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const aiKnowledgeMetadataSchema = z.record(z.string(), aiKnowledgeMetadataValueSchema)

export const knowledgeChunkConfigSchema = z.object({
  chunkOverlap: z.number().int().min(0).max(512).default(64),
  chunkSize: z.number().int().min(128).max(2048).default(512),
})

export const aiKnowledgeDocumentInputSchema = z
  .object({
    content: z.string().trim().min(1),
    documentId: z.string().uuid(),
    metadata: aiKnowledgeMetadataSchema.default({}),
    sourceType: z.string().trim().min(1).max(50),
    sourceUri: z.string().trim().max(500).nullable().optional(),
    title: z.string().trim().min(1).max(255),
  })
  .merge(knowledgeChunkConfigSchema)

export const aiKnowledgeChunkSchema = z.object({
  chunkIndex: z.number().int().min(0),
  content: z.string().min(1),
  endOffset: z.number().int().min(0),
  startOffset: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
})

export const aiKnowledgeChunkInsertSchema = z.object({
  chunkIndex: z.number().int().min(0),
  content: z.string().min(1),
  contentHash: z.string().length(64),
  embedding: z.array(z.number()),
  tokenCount: z.number().int().min(0),
})

export const aiKnowledgeIndexResultSchema = z.object({
  chunkCount: z.number().int().min(0),
  documentId: z.string().uuid(),
  sourceType: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
})

export const semanticKnowledgeSearchInputSchema = z.object({
  documentId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(5),
  query: z.string().trim().min(1).max(500),
  sourceType: z.string().trim().min(1).max(50).optional(),
})

export const semanticKnowledgeSearchMatchSchema = z.object({
  chunkIndex: z.number().int().min(0),
  content: z.string().min(1),
  createdAt: z.string(),
  distance: z.number().min(0),
  documentId: z.string().uuid(),
  id: z.string().uuid(),
  metadata: aiKnowledgeMetadataSchema,
  similarity: z.number().min(0),
  sourceType: z.string().trim().min(1).max(50),
  sourceUri: z.string().nullable(),
  title: z.string().trim().min(1).max(255),
  tokenCount: z.number().int().min(0),
})

export const semanticKnowledgeSearchOutputSchema = z.object({
  matches: z.array(semanticKnowledgeSearchMatchSchema),
  query: z.string().trim().min(1).max(500),
})

export type AiKnowledgeChunk = z.infer<typeof aiKnowledgeChunkSchema>
export type AiKnowledgeDocumentInput = z.infer<typeof aiKnowledgeDocumentInputSchema>
export type AiKnowledgeChunkInsert = z.infer<typeof aiKnowledgeChunkInsertSchema>
export type AiKnowledgeIndexResult = z.infer<typeof aiKnowledgeIndexResultSchema>
export type AiKnowledgeMetadata = z.infer<typeof aiKnowledgeMetadataSchema>
export type SemanticKnowledgeSearchInput = z.infer<typeof semanticKnowledgeSearchInputSchema>
export type SemanticKnowledgeSearchMatch = z.infer<typeof semanticKnowledgeSearchMatchSchema>
export type SemanticKnowledgeSearchOutput = z.infer<typeof semanticKnowledgeSearchOutputSchema>
