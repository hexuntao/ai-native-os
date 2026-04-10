import type { AiRuntimeCapability, AppAbility } from '@ai-native-os/shared'

import { isCopilotCapabilityEnabled, resolveAiRuntimeCapability } from './capabilities'
import { aiAuditLogSearchRegistration } from './tools/ai-audit-log-search'
import type { RegisteredMastraTool } from './tools/base'
import { knowledgeSemanticSearchRegistration } from './tools/knowledge-semantic-search'
import { operationLogSearchRegistration } from './tools/operation-log-search'
import { permissionProfileRegistration } from './tools/permission-profile'
import { reportDataSnapshotRegistration } from './tools/report-data-snapshot'
import { runtimeConfigRegistration } from './tools/runtime-config'
import { userDirectoryRegistration } from './tools/user-directory'

export interface EnabledMcpWrapperToolIds {
  agent: string[]
  direct: string[]
  workflow: string[]
}

const adminCopilotToolRequirements = [
  userDirectoryRegistration,
  permissionProfileRegistration,
  runtimeConfigRegistration,
  reportDataSnapshotRegistration,
  knowledgeSemanticSearchRegistration,
] as const satisfies readonly RegisteredMastraTool[]

const auditAnalystToolRequirements = [
  operationLogSearchRegistration,
  aiAuditLogSearchRegistration,
  reportDataSnapshotRegistration,
] as const satisfies readonly RegisteredMastraTool[]

const copilotAgentRequirements = {
  'admin-copilot': adminCopilotToolRequirements,
  'audit-analyst': auditAnalystToolRequirements,
} as const satisfies Record<string, readonly RegisteredMastraTool[]>

/**
 * 判断主体是否具备访问指定 Mastra Tool 的最小权限。
 */
function canAccessMastraTool(ability: AppAbility, tool: RegisteredMastraTool): boolean {
  return ability.can(tool.permission.action, tool.permission.subject)
}

/**
 * 判断主体是否具备执行报表 Workflow 的最小权限。
 */
export function canRunReportScheduleWorkflow(ability: AppAbility): boolean {
  return ability.can('export', 'Report')
}

/**
 * 返回当前主体真正可用的 Copilot Agent 清单。
 *
 * 设计约束：
 * - Agent discovery 不能只看“是否已注册”，还要看主体是否满足其依赖 Tool 的最小权限
 * - 当 AI runtime 处于 degraded 时，所有依赖远程模型的 Agent 都必须隐藏
 */
export function getEnabledCopilotAgentIds(
  ability: AppAbility,
  capability: AiRuntimeCapability = resolveAiRuntimeCapability(),
): string[] {
  if (!isCopilotCapabilityEnabled(capability)) {
    return []
  }

  return Object.entries(copilotAgentRequirements)
    .filter(([, requiredTools]) =>
      requiredTools.every((tool) => canAccessMastraTool(ability, tool)),
    )
    .map(([agentId]) => agentId)
    .sort()
}

/**
 * 返回当前主体在 MCP wrapper 层真正应该暴露的入口清单。
 *
 * 这里把 direct tool、workflow、agent wrapper 的可见性统一收敛到同一套能力判定，
 * 避免 discovery、runtime summary 和实际执行面再次漂移。
 */
export function getEnabledMcpWrapperToolIds(
  ability: AppAbility,
  capability: AiRuntimeCapability = resolveAiRuntimeCapability(),
): EnabledMcpWrapperToolIds {
  const enabledAgentIds = getEnabledCopilotAgentIds(ability, capability)

  return {
    agent: enabledAgentIds.includes('admin-copilot') ? ['ask_admin_copilot'] : [],
    direct: canAccessMastraTool(ability, userDirectoryRegistration) ? ['tool_user_directory'] : [],
    workflow: canRunReportScheduleWorkflow(ability) ? ['run_report_schedule'] : [],
  }
}
