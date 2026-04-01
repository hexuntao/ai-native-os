import { Mastra } from '@mastra/core/mastra'

import { resolveMastraEnvironment } from './env'
import { mastraAgents, mastraTools, mastraWorkflows } from './registry'

export const mastraEnvironment = resolveMastraEnvironment()

export const mastra = new Mastra({
  agents: mastraAgents,
  tools: mastraTools,
  workflows: mastraWorkflows,
})

export interface MastraRuntimeSummary {
  agentCount: number
  defaultModel: string
  openapiPath: string
  routePrefix: string
  toolCount: number
  workflowCount: number
}

export function getMastraRuntimeSummary(): MastraRuntimeSummary {
  return {
    agentCount: Object.keys(mastraAgents).length,
    defaultModel: mastraEnvironment.defaultModel,
    openapiPath: mastraEnvironment.openapiPath,
    routePrefix: mastraEnvironment.routePrefix,
    toolCount: Object.keys(mastraTools).length,
    workflowCount: Object.keys(mastraWorkflows).length,
  }
}
