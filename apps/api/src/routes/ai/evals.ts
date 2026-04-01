import {
  type AiEvalListResponse,
  aiEvalListResponseSchema,
  type ListAiEvalsInput,
  listAiEvalsInputSchema,
} from '@ai-native-os/shared'

import { buildMastraEvalCatalogSnapshot } from '@/mastra/evals/runner'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

/**
 * 读取评估目录和最近运行结果，供 AI eval 面板展示。
 */
export async function listAiEvals(input: ListAiEvalsInput): Promise<AiEvalListResponse> {
  const snapshot = await buildMastraEvalCatalogSnapshot()
  const pagedEntries = paginateArray(snapshot.entries, input.page, input.pageSize)

  return {
    data: pagedEntries.map((entry) => ({
      backing: 'mastra',
      datasetSize: entry.datasetSize,
      id: entry.id,
      lastRunAt: entry.lastRunAt,
      lastRunAverageScore: entry.lastRunAverageScore,
      lastRunStatus: entry.lastRunStatus,
      name: entry.name,
      notes: entry.notes,
      scorerCount: entry.scorerCount,
      status: entry.status,
    })),
    pagination: createPagination(input.page, input.pageSize, snapshot.entries.length),
    summary: {
      configured: snapshot.configured,
      reason: snapshot.reason,
      totalDatasets: snapshot.totalDatasets,
      totalExperiments: snapshot.totalExperiments,
    },
  }
}

/**
 * 提供 AI 评估目录与最近运行结果接口。
 */
export const aiEvalsListProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'AiKnowledge' },
])
  .route({
    method: 'GET',
    path: '/api/v1/ai/evals',
    tags: ['AI:Evals'],
    summary: 'List AI evaluation runs',
    description: 'Returns registered eval suites with persisted experiment summaries.',
  })
  .input(listAiEvalsInputSchema)
  .output(aiEvalListResponseSchema)
  .handler(async ({ input }) => listAiEvals(input))
