import { Mastra } from '@mastra/core/mastra'

import { resolveMastraEnvironment } from './env'
import { getMastraEvalScorerRegistry } from './evals/registry'
import { mastraAgents, mastraTools, mastraWorkflows } from './registry'

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
  defaultModel: string
  openapiPath: string
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

  return {
    agentCount: registeredAgentIds.length,
    defaultModel: mastraEnvironment.defaultModel,
    openapiPath: mastraEnvironment.openapiPath,
    registeredAgentIds,
    registeredWorkflowIds,
    routePrefix: mastraEnvironment.routePrefix,
    runtimeStage: resolveRuntimeStage(registeredAgentIds.length, registeredWorkflowIds.length),
    toolCount: Object.keys(mastraTools).length,
    workflowCount: registeredWorkflowIds.length,
  }
}
