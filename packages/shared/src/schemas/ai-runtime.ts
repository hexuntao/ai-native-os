import { z } from 'zod'

/**
 * AI 运行时总状态。
 *
 * - `enabled` 表示远程模型能力已就绪
 * - `degraded` 表示核心 API 仍可用，但 LLM 相关入口必须显式降级
 */
export const aiRuntimeStatusSchema = z.enum(['degraded', 'enabled'])

/**
 * AI embedding provider 摘要。
 *
 * 当前仓库仅支持：
 * - `openai`：真实远程 embedding
 * - `deterministic-local`：开发/测试环境的本地确定性 fallback
 */
export const aiEmbeddingProviderSchema = z.enum(['deterministic-local', 'openai'])

/**
 * AI 运行时能力快照。
 *
 * 这份 contract 用于 health、runtime summary、Copilot bridge 等多个发现入口，
 * 避免不同入口各自描述“AI 当前是否可用”而产生漂移。
 */
export const aiRuntimeCapabilitySchema = z.object({
  copilot: aiRuntimeStatusSchema,
  defaultModel: z.string().min(1),
  embeddingProvider: aiEmbeddingProviderSchema,
  openaiApiKeyConfigured: z.boolean(),
  reason: z.string().min(1),
  remoteEmbeddings: aiRuntimeStatusSchema,
  status: aiRuntimeStatusSchema,
  unavailableSurfaces: z.array(z.string().min(1)),
})

export type AiRuntimeCapability = z.infer<typeof aiRuntimeCapabilitySchema>
export type AiRuntimeStatus = z.infer<typeof aiRuntimeStatusSchema>
export type AiEmbeddingProvider = z.infer<typeof aiEmbeddingProviderSchema>
