import type { AiRuntimeCapability } from '@ai-native-os/shared'
import { Mastra } from '@mastra/core/mastra'

import { isCopilotCapabilityEnabled, resolveAiRuntimeCapability } from './capabilities'
import { resolveMastraEnvironment } from './env'
import { getMastraEvalScorerRegistry } from './evals/registry'
import { mastraAgents, mastraRuntimeCoverage, mastraTools, mastraWorkflows } from './registry'
import type { MastraRuntimeCoverageMode } from './runtime-coverage'

/**
 * Mastra 运行时入口。
 *
 * 职责边界：
 * - 只负责组装当前已注册的 Agent、Tool、Workflow 并暴露运行时摘要
 * - 不直接承载权限判断；真实权限边界在 API/Mastra middleware 与 Tool 层完成
 * - 不直接写审计日志；审计由 Tool/Workflow 执行链路负责
 */
export const mastraEnvironment = resolveMastraEnvironment()
const mastraScorers = getMastraEvalScorerRegistry()

export const mastra = new Mastra({
  agents: mastraAgents,
  scorers: mastraScorers,
  tools: mastraTools,
  workflows: mastraWorkflows,
})

export interface MastraRuntimeSummary {
  agentCount: number
  ai: AiRuntimeCapability
  coverageMode: MastraRuntimeCoverageMode
  coverageRationale: string
  defaultModel: string
  degradedAgentIds: string[]
  enabledAgentCount: number
  enabledAgentIds: string[]
  openapiPath: string
  plannedAgentIds: string[]
  plannedWorkflowIds: string[]
  registeredAgentIds: string[]
  registeredWorkflowIds: string[]
  routePrefix: string
  runtimeStage: 'agents_ready' | 'tools_only' | 'workflows_ready'
  toolCount: number
  workflowCount: number
}

function resolveRuntimeStage(
  agentCount: number,
  workflowCount: number,
): MastraRuntimeSummary['runtimeStage'] {
  if (workflowCount > 0) {
    return 'workflows_ready'
  }

  if (agentCount > 0) {
    return 'agents_ready'
  }

  return 'tools_only'
}

// 输出运行时真实注册表快照，避免测试和观测层把“当前为空”误认为稳定契约。
export function getMastraRuntimeSummary(): MastraRuntimeSummary {
  const registeredAgentIds = Object.keys(mastraAgents)
  const registeredWorkflowIds = Object.keys(mastraWorkflows)
  const aiCapability = resolveAiRuntimeCapability()
  const enabledAgentIds = isCopilotCapabilityEnabled(aiCapability) ? registeredAgentIds : []
  const degradedAgentIds = registeredAgentIds.filter(
    (agentId) => !enabledAgentIds.includes(agentId),
  )

  return {
    agentCount: registeredAgentIds.length,
    ai: aiCapability,
    coverageMode: mastraRuntimeCoverage.mode,
    coverageRationale: mastraRuntimeCoverage.rationale,
    defaultModel: mastraEnvironment.defaultModel,
    degradedAgentIds,
    enabledAgentCount: enabledAgentIds.length,
    enabledAgentIds,
    openapiPath: mastraEnvironment.openapiPath,
    plannedAgentIds: mastraRuntimeCoverage.plannedAgentIds,
    plannedWorkflowIds: mastraRuntimeCoverage.plannedWorkflowIds,
    registeredAgentIds,
    registeredWorkflowIds,
    routePrefix: mastraEnvironment.routePrefix,
    runtimeStage: resolveRuntimeStage(registeredAgentIds.length, registeredWorkflowIds.length),
    toolCount: Object.keys(mastraTools).length,
    workflowCount: registeredWorkflowIds.length,
  }
}
