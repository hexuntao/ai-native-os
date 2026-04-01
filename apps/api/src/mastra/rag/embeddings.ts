import { createHash } from 'node:crypto'

import { aiKnowledgeEmbeddingDimensions } from '@ai-native-os/db'
import { createOpenAI } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

export interface EmbeddingEnvironment {
  embeddingDimensions: number
  modelId: string
  provider: 'deterministic-local' | 'openai'
}

const defaultEmbeddingModelId = 'text-embedding-3-small'

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.hypot(...vector)

  if (magnitude === 0) {
    return vector
  }

  return vector.map((value) => value / magnitude)
}

function extractTokens(content: string): string[] {
  return content.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []
}

function createDeterministicEmbedding(content: string): number[] {
  const vector: number[] = new Array<number>(aiKnowledgeEmbeddingDimensions).fill(0)
  const tokens = extractTokens(content)

  if (tokens.length === 0) {
    return vector
  }

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest()
    const slot = digest.readUInt32BE(0) % aiKnowledgeEmbeddingDimensions
    const sign = digest.readUInt8(4) % 2 === 0 ? 1 : -1
    const weight = 1 + token.length / 32
    const currentValue = vector[slot] ?? 0

    vector[slot] = currentValue + sign * weight
  }

  return normalizeVector(vector)
}

/**
 * 解析当前 RAG embedding 运行时。
 *
 * 规则：
 * - 生产环境必须显式提供 `OPENAI_API_KEY`
 * - 开发与测试环境允许使用确定性本地 embedding，保证 QA 和离线开发可执行
 */
export function resolveEmbeddingEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingEnvironment {
  const modelId = env.MASTRA_RAG_EMBEDDING_MODEL ?? defaultEmbeddingModelId

  if (env.OPENAI_API_KEY) {
    return {
      embeddingDimensions: aiKnowledgeEmbeddingDimensions,
      modelId,
      provider: 'openai',
    }
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('OPENAI_API_KEY is required for production RAG embeddings')
  }

  return {
    embeddingDimensions: aiKnowledgeEmbeddingDimensions,
    modelId,
    provider: 'deterministic-local',
  }
}

function requireOpenAiApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for remote RAG embeddings')
  }

  return apiKey
}

/**
 * 为单条查询文本生成 embedding。
 */
export async function embedKnowledgeQuery(
  query: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number[]> {
  const embeddingEnvironment = resolveEmbeddingEnvironment(env)

  if (embeddingEnvironment.provider === 'deterministic-local') {
    return createDeterministicEmbedding(query)
  }

  const openai = createOpenAI({
    apiKey: requireOpenAiApiKey(env),
  })
  const result = await embed({
    model: openai.textEmbeddingModel(embeddingEnvironment.modelId),
    value: query,
  })

  return result.embedding
}

/**
 * 为多个知识分块批量生成 embedding。
 */
export async function embedKnowledgeChunks(
  contents: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number[][]> {
  const embeddingEnvironment = resolveEmbeddingEnvironment(env)

  if (embeddingEnvironment.provider === 'deterministic-local') {
    return contents.map((content) => createDeterministicEmbedding(content))
  }

  const openai = createOpenAI({
    apiKey: requireOpenAiApiKey(env),
  })
  const result = await embedMany({
    model: openai.textEmbeddingModel(embeddingEnvironment.modelId),
    values: contents,
  })

  return result.embeddings
}
