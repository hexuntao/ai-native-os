import {
  type ListToolJobsInput,
  listToolJobsInputSchema,
  type ToolJobsListResponse,
  toolJobsListResponseSchema,
  triggerJobCatalog,
} from '@ai-native-os/shared'

import { getMastraRuntimeSummary } from '@/mastra'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

type ToolJobListItem = ToolJobsListResponse['data'][number]

/**
 * 构建任务调度发现目录。
 *
 * 说明：
 * - 任务目录来自 shared contract，避免 `api -> jobs -> api` 的反向依赖循环
 * - workflow 关联关系以当前 Mastra runtime 已注册的 workflow 为准
 */
function buildToolJobsCatalog(): ToolJobListItem[] {
  const runtimeSummary = getMastraRuntimeSummary()
  const registeredWorkflowIds = new Set(runtimeSummary.registeredWorkflowIds)

  return triggerJobCatalog.map((job) => ({
    description: job.description,
    id: job.id,
    mode: job.mode,
    name: job.name,
    schedule: job.schedule,
    status: job.mode === 'scheduled' ? 'scheduled' : 'registered',
    triggerConfigPath: 'apps/jobs/trigger.config.ts',
    workflowId: job.workflowId && registeredWorkflowIds.has(job.workflowId) ? job.workflowId : null,
  }))
}

/**
 * 提供任务调度发现页的最小只读 skeleton 列表。
 */
export async function listToolJobs(
  input: ListToolJobsInput | undefined,
): Promise<ToolJobsListResponse> {
  const resolvedInput = listToolJobsInputSchema.parse(input)
  const normalizedSearch = resolvedInput.search?.trim().toLowerCase()
  const catalog = buildToolJobsCatalog().filter((item) => {
    if (resolvedInput.mode && item.mode !== resolvedInput.mode) {
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
      registeredCount: catalog.length,
      scheduledCount: catalog.filter((item) => item.mode === 'scheduled').length,
      workflowLinkedCount: catalog.filter((item) => item.workflowId !== null).length,
    },
  }
}

/**
 * 提供任务调度发现页的最小只读 skeleton 列表。
 */
export const toolJobsListProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiWorkflow' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/tools/jobs',
    tags: ['Tools:Jobs'],
    summary: '分页查询任务调度目录',
    description: '返回已注册的 Trigger.dev 任务目录及其 Workflow 关联元数据。',
  })
  .input(listToolJobsInputSchema)
  .output(toolJobsListResponseSchema)
  .handler(async ({ input }) => listToolJobs(input))
