/**
 * Mastra 运行时覆盖清单。
 *
 * 职责边界：
 * - 明确记录当前仓库已经接线并允许对外暴露的最小安全 Agent / Workflow 集合
 * - 同时记录设计文档中的后续扩展蓝图，避免把目标蓝图误读为当前运行时清单
 * - 为运行时摘要、启动期一致性校验和文档纠偏提供单一事实来源
 */
export const implementedMastraAgentIds = ['admin-copilot', 'audit-analyst'] as const
export const plannedMastraAgentIds = [
  'data-analyst',
  'approval-agent',
  'anomaly-detector',
  'report-generator',
] as const

export const implementedMastraWorkflowIds = ['report-schedule'] as const
export const plannedMastraWorkflowIds = ['approval-flow', 'data-cleanup', 'onboarding'] as const

export type MastraRuntimeCoverageMode = 'minimum-safe'

export interface MastraRuntimeCoverage {
  implementedAgentIds: string[]
  implementedWorkflowIds: string[]
  mode: MastraRuntimeCoverageMode
  plannedAgentIds: string[]
  plannedWorkflowIds: string[]
  rationale: string
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right))
}

/**
 * 返回当前仓库认可的 Mastra 运行时覆盖面。
 *
 * 这里显式把当前状态标记为 `minimum-safe`，表示：
 * - 只公开已经完成 Tool 级 RBAC、审计和最小权限收敛的只读能力
 * - 其余 Agent / Workflow 仍是设计蓝图，不能被误认为已上线能力
 */
export function getMastraRuntimeCoverage(): MastraRuntimeCoverage {
  return {
    implementedAgentIds: sortIds(implementedMastraAgentIds),
    implementedWorkflowIds: sortIds(implementedMastraWorkflowIds),
    mode: 'minimum-safe',
    plannedAgentIds: sortIds(plannedMastraAgentIds),
    plannedWorkflowIds: sortIds(plannedMastraWorkflowIds),
    rationale:
      '当前运行时只暴露已完成 RBAC、审计和只读边界收敛的最小安全 Agent / Workflow；审批型、写操作型和更高风险编排仍保留为后续扩展蓝图。',
  }
}

function assertSameIds(
  label: string,
  actualIds: readonly string[],
  expectedIds: readonly string[],
): void {
  const normalizedActualIds = sortIds(actualIds)
  const normalizedExpectedIds = sortIds(expectedIds)

  if (normalizedActualIds.length !== normalizedExpectedIds.length) {
    throw new Error(
      `Mastra ${label} inventory drift: expected ${normalizedExpectedIds.join(', ')}, received ${normalizedActualIds.join(', ')}`,
    )
  }

  for (const [index, actualId] of normalizedActualIds.entries()) {
    if (actualId !== normalizedExpectedIds[index]) {
      throw new Error(
        `Mastra ${label} inventory drift: expected ${normalizedExpectedIds.join(', ')}, received ${normalizedActualIds.join(', ')}`,
      )
    }
  }
}

/**
 * 校验实际注册表与文档认可的“当前运行时清单”保持一致。
 *
 * 这里故意在启动阶段快速失败，防止代码已经扩容或收缩，但文档与状态仍停留在旧口径。
 */
export function assertMastraRuntimeCoverageMatchesRegistry(args: {
  actualAgentIds: readonly string[]
  actualWorkflowIds: readonly string[]
}): void {
  const coverage = getMastraRuntimeCoverage()

  assertSameIds('agent registry', args.actualAgentIds, coverage.implementedAgentIds)
  assertSameIds('workflow registry', args.actualWorkflowIds, coverage.implementedWorkflowIds)
}
