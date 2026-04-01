import assert from 'node:assert/strict'
import test from 'node:test'

import { replaceKnowledgeDocument, semanticSearchKnowledge } from './knowledge'

const dimensionCount = 1536

function createSparseEmbedding(activeIndex: number): number[] {
  return Array.from({ length: dimensionCount }, (_, index) => (index === activeIndex ? 1 : 0))
}

test('semanticSearchKnowledge ranks the closest chunk first', async () => {
  const documentId = '2caa62f8-e2fe-4ad3-a0d6-f9e9dc5df67d'

  await replaceKnowledgeDocument({
    chunks: [
      {
        chunkIndex: 0,
        content: 'Quarterly revenue report and finance summary.',
        contentHash: '1111111111111111111111111111111111111111111111111111111111111111',
        embedding: createSparseEmbedding(3),
        tokenCount: 6,
      },
      {
        chunkIndex: 1,
        content: 'Employee onboarding checklist and account setup guide.',
        contentHash: '2222222222222222222222222222222222222222222222222222222222222222',
        embedding: createSparseEmbedding(8),
        tokenCount: 7,
      },
    ],
    documentId,
    metadata: {
      locale: 'en-US',
    },
    sourceType: 'manual',
    sourceUri: 'https://example.com/handbook',
    title: 'Operations Handbook',
  })

  const matches = await semanticSearchKnowledge({
    limit: 2,
    queryEmbedding: createSparseEmbedding(8),
  })

  assert.equal(matches[0]?.documentId, documentId)
  assert.equal(matches[0]?.chunkIndex, 1)
  assert.equal(matches[0]?.title, 'Operations Handbook')
  assert.ok((matches[0]?.similarity ?? 0) > (matches[1]?.similarity ?? 0))
})
