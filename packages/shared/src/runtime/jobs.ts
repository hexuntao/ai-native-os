/**
 * Trigger.dev 任务目录合同。
 *
 * 职责边界：
 * - 只声明跨 API / Jobs 共享的任务发现元数据
 * - 不包含任何执行逻辑、平台 SDK 调用或权限判断
 */
export interface TriggerJobCatalogItem {
  description: string
  id: 'ai-eval-runner' | 'rag-indexing' | 'report-schedule-trigger'
  mode: 'manual' | 'scheduled'
  name: string
  schedule: string | null
  workflowId: 'report-schedule' | null
}

/**
 * 当前已注册的 Trigger.dev 任务目录。
 */
export const triggerJobCatalog = [
  {
    description: '按需触发的知识库索引任务，负责把文档切块、向量化并写入知识库。',
    id: 'rag-indexing',
    mode: 'manual',
    name: 'RAG Indexing',
    schedule: null,
    workflowId: null,
  },
  {
    description: '每日定时触发报表 workflow，生成系统快照摘要。',
    id: 'report-schedule-trigger',
    mode: 'scheduled',
    name: 'Report Schedule Trigger',
    schedule: '0 8 * * *',
    workflowId: 'report-schedule',
  },
  {
    description: '每日定时执行 Mastra eval suites，验证 AI runtime 质量门。',
    id: 'ai-eval-runner',
    mode: 'scheduled',
    name: 'AI Eval Runner',
    schedule: '15 8 * * *',
    workflowId: null,
  },
] as const satisfies readonly TriggerJobCatalogItem[]

/**
 * 已启用的计划任务 ID 列表。
 */
export const scheduledTriggerJobIds = triggerJobCatalog
  .filter((job) => job.mode === 'scheduled')
  .map((job) => job.id)

/**
 * 已注册的任务 ID 列表。
 */
export const triggerJobIds = triggerJobCatalog.map((job) => job.id)
