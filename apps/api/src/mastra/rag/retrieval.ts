import { semanticSearchKnowledge } from '@ai-native-os/db'
import {
  type SemanticKnowledgeSearchInput,
  type SemanticKnowledgeSearchOutput,
  semanticKnowledgeSearchInputSchema,
  semanticKnowledgeSearchOutputSchema,
} from '@ai-native-os/shared'

import { embedKnowledgeQuery } from './embeddings'

/**
 * 对知识库执行语义检索。
 */
export async function semanticSearchKnowledgeBase(
  input: SemanticKnowledgeSearchInput,
): Promise<SemanticKnowledgeSearchOutput> {
  const parsedInput = semanticKnowledgeSearchInputSchema.parse(input)
  const queryEmbedding = await embedKnowledgeQuery(parsedInput.query)
  const searchArgs = {
    limit: parsedInput.limit,
    queryEmbedding,
    ...(parsedInput.documentId ? { documentId: parsedInput.documentId } : {}),
    ...(parsedInput.sourceType ? { sourceType: parsedInput.sourceType } : {}),
  }
  const matches = await semanticSearchKnowledge(searchArgs)

  return semanticKnowledgeSearchOutputSchema.parse({
    matches,
    query: parsedInput.query,
  })
}
