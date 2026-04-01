import { adminCopilot } from './admin-copilot'
import { auditAnalyst } from './audit-analyst'

/**
 * 首批 Agent 注册表。
 *
 * 当前策略：
 * - 仅注册只读 Agent，避免在 route-level authorization 尚未强化前引入写风险
 * - 每个 Agent 只能组合已经具备 Tool 级 RBAC 与 AI 审计能力的工具
 */
export const mastraAgentRegistry = {
  'admin-copilot': adminCopilot,
  'audit-analyst': auditAnalyst,
}

export { adminCopilot, auditAnalyst }
