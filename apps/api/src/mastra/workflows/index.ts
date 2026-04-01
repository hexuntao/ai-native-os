import { reportSchedule } from './report-schedule'

/**
 * Workflow 注册表。
 *
 * 职责边界：
 * - 只统一导出当前启用的 Workflow
 * - 不在这里做权限判断和审计补偿
 * - Workflow 的安全边界与审计责任必须留在各自模块内部
 */
const registeredMastraWorkflows = [reportSchedule] as const

export const mastraWorkflowRegistry = registeredMastraWorkflows

export { reportSchedule }

export const mastraWorkflows = Object.fromEntries(
  registeredMastraWorkflows.map((workflow) => [workflow.id, workflow]),
)
