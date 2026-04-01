import type { AiKnowledgeMetadata } from '@ai-native-os/shared'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core'

export const aiKnowledgeEmbeddingDimensions = 1536

export const aiKnowledge = pgTable(
  'ai_knowledge',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    embedding: vector('embedding', {
      dimensions: aiKnowledgeEmbeddingDimensions,
    }).notNull(),
    metadata: jsonb('metadata').$type<AiKnowledgeMetadata>().notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    tokenCount: integer('token_count').notNull(),
    sourceType: varchar('source_type', { length: 50 }).notNull(),
    sourceUri: varchar('source_uri', { length: 500 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ai_knowledge_document_chunk_uidx').on(table.documentId, table.chunkIndex),
    index('ai_knowledge_document_idx').on(table.documentId),
    index('ai_knowledge_source_type_idx').on(table.sourceType),
    index('ai_knowledge_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
)
