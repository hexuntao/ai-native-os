import type { ToolAction, ToolExecutionContext } from '@mastra/core/tools'

import { mastraAgentRegistry } from './agents'
import {
  assertMastraRuntimeCoverageMatchesRegistry,
  getMastraRuntimeCoverage,
} from './runtime-coverage'
import { mastraTools as registeredMastraTools } from './tools'
import { mastraWorkflows as registeredMastraWorkflows } from './workflows'

assertMastraRuntimeCoverageMatchesRegistry({
  actualAgentIds: Object.keys(mastraAgentRegistry),
  actualWorkflowIds: Object.keys(registeredMastraWorkflows),
})

/**
 * Mastra 注册表。
 *
 * 职责边界：
 * - 统一汇总当前可用的 Agent、Tool、Workflow
 * - 不在这里做权限判断；权限必须下沉到 middleware 和 Tool/Workflow 执行层
 * - 不在这里直接写审计；审计责任由可执行单元自身承担
 *
 * 当前状态：
 * - Tool 已启用并受 RBAC + audit 约束
 * - 运行时当前按 `minimum-safe` 模式暴露能力，只注册只读 Agent 与只读 Workflow
 * - 设计文档中的扩展 Agent / Workflow 仍保留为蓝图，不在这里伪装成已上线能力
 */
export const mastraAgents = mastraAgentRegistry
export const mastraRuntimeCoverage = getMastraRuntimeCoverage()

export const mastraTools = registeredMastraTools as Record<
  string,
  ToolAction<
    unknown,
    unknown,
    unknown,
    unknown,
    ToolExecutionContext<unknown, unknown, unknown>,
    string,
    unknown
  >
>

export const mastraWorkflows = registeredMastraWorkflows
