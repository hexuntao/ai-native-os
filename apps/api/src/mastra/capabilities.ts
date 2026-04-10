import { type AiRuntimeCapability, aiRuntimeCapabilitySchema } from '@ai-native-os/shared'

import { resolveMastraEnvironment } from './env'

/**
 * 解析 AI 运行时能力快照。
 *
 * 设计原则：
 * - 不因为缺失 `OPENAI_API_KEY` 直接打死整个 API 进程
 * - 把 LLM 相关入口的失败从执行期前移到发现期与健康态
 * - 保留非 LLM 的 metadata / direct tool / health 能力继续可用
 */
export function resolveAiRuntimeCapability(
  environment: NodeJS.ProcessEnv = process.env,
): AiRuntimeCapability {
  const mastraEnvironment = resolveMastraEnvironment(environment)
  const openaiApiKeyConfigured = Boolean(environment.OPENAI_API_KEY?.trim())

  if (openaiApiKeyConfigured) {
    return aiRuntimeCapabilitySchema.parse({
      copilot: 'enabled',
      defaultModel: mastraEnvironment.defaultModel,
      embeddingProvider: 'openai',
      openaiApiKeyConfigured: true,
      reason:
        'OPENAI_API_KEY is configured; Copilot and remote embedding capabilities are enabled.',
      remoteEmbeddings: 'enabled',
      status: 'enabled',
      unavailableSurfaces: [],
    })
  }

  return aiRuntimeCapabilitySchema.parse({
    copilot: 'degraded',
    defaultModel: mastraEnvironment.defaultModel,
    embeddingProvider: 'deterministic-local',
    openaiApiKeyConfigured: false,
    reason:
      'OPENAI_API_KEY is missing; Copilot and remote embedding capabilities are disabled until a real upstream model key is configured.',
    remoteEmbeddings: 'degraded',
    status: 'degraded',
    unavailableSurfaces: ['copilot', 'remote-embeddings'],
  })
}

/**
 * 判断当前是否允许暴露依赖远程模型的 Copilot/Agent 入口。
 */
export function isCopilotCapabilityEnabled(
  capability: AiRuntimeCapability = resolveAiRuntimeCapability(),
): boolean {
  return capability.copilot === 'enabled'
}
