import {
  type ListToolGenInput,
  listToolGenInputSchema,
  type ToolGenListResponse,
  toolGenListResponseSchema,
} from '@ai-native-os/shared'

import { defaultCopilotAgentId } from '@/copilotkit/runtime'
import { mastraAgentRegistry } from '@/mastra/agents'
import { resolveMastraEnvironment } from '@/mastra/env'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

type ToolGenListItem = ToolGenListResponse['data'][number]

const generationAgentMetadata: Record<
  keyof typeof mastraAgentRegistry,
  {
    description: string
    name: string
  }
> = {
  'admin-copilot': {
    description: '面向后台管理员的只读 Copilot 入口，提供查询、检索与摘要生成能力。',
    name: 'Admin Copilot',
  },
  'audit-analyst': {
    description: '面向审计与运维场景的只读分析入口，聚合日志与审计结果。',
    name: 'Audit Analyst',
  },
}

/**
 * 构建当前已接线的生成能力目录。
 *
 * 说明：
 * - 当前仓库并没有独立的“代码生成器”业务子系统
 * - 因此这里先暴露真实存在的 AI 生成入口与 prompt 治理入口，保证 contract-first 面真实可访问
 */
function buildToolGenCatalog(): ToolGenListItem[] {
  const mastraEnvironment = resolveMastraEnvironment(process.env)
  const registeredAgentIds = Object.keys(mastraAgentRegistry) as Array<
    keyof typeof mastraAgentRegistry
  >
  const agentItems = registeredAgentIds.map((agentId) => {
    const metadata = generationAgentMetadata[agentId]
    const backing: ToolGenListItem['backing'] =
      agentId === defaultCopilotAgentId ? 'copilotkit' : 'mastra-agent'
    const kind: ToolGenListItem['kind'] = agentId === defaultCopilotAgentId ? 'copilot' : 'agent'
    const status: ToolGenListItem['status'] = 'available'

    return {
      backing,
      description: metadata.description,
      id: agentId,
      kind,
      name: metadata.name,
      routePath: `${mastraEnvironment.routePrefix}/agents/${agentId}`,
      status,
    }
  })
  const promptStatus: ToolGenListItem['status'] = 'available'

  return [
    ...agentItems,
    {
      backing: 'prompt-governance',
      description: 'Prompt 版本、证据挂接与发布门禁入口。',
      id: 'prompt-governance',
      kind: 'prompt',
      name: 'Prompt Governance',
      routePath: '/api/v1/ai/prompts',
      status: promptStatus,
    },
  ]
}

/**
 * 提供生成能力发现页的最小只读 skeleton 列表。
 */
export async function listToolGen(
  input: ListToolGenInput | undefined,
): Promise<ToolGenListResponse> {
  const resolvedInput = listToolGenInputSchema.parse(input)
  const normalizedSearch = resolvedInput.search?.trim().toLowerCase()
  const catalog = buildToolGenCatalog().filter((item) => {
    if (resolvedInput.kind && item.kind !== resolvedInput.kind) {
      return false
    }

    if (resolvedInput.status && item.status !== resolvedInput.status) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [item.id, item.name, item.description].some((field) =>
      field.toLowerCase().includes(normalizedSearch),
    )
  })
  const pagedData = paginateArray(catalog, resolvedInput.page, resolvedInput.pageSize)

  return {
    data: pagedData,
    pagination: createPagination(resolvedInput.page, resolvedInput.pageSize, catalog.length),
    summary: {
      availableCount: catalog.filter((item) => item.status === 'available').length,
      plannedCount: catalog.filter((item) => item.status === 'planned').length,
    },
  }
}

/**
 * 提供生成能力发现页的最小只读 skeleton 列表。
 */
export const toolGenListProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiAgent' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/tools/gen',
    tags: ['Tools:Gen'],
    summary: '分页查询生成能力入口',
    description: '返回当前已接线的 Copilot、Agent 与 Prompt 治理入口目录。',
  })
  .input(listToolGenInputSchema)
  .output(toolGenListResponseSchema)
  .handler(async ({ input }) => listToolGen(input))
