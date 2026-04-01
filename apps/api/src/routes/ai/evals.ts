import {
  type AiEvalListResponse,
  aiEvalListResponseSchema,
  type ListAiEvalsInput,
  listAiEvalsInputSchema,
} from '@ai-native-os/shared'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供 AI evals 面板的 contract-first 骨架。
 *
 * 当前仓库尚未引入 Eval 持久化表和实验注册，因此这里先返回稳定的空列表与能力摘要，
 * 让前端页面能够按文档路径接入，而不是继续依赖不存在的接口。
 */
export async function listAiEvals(input: ListAiEvalsInput): Promise<AiEvalListResponse> {
  return {
    data: [],
    pagination: createPagination(input.page, input.pageSize, 0),
    summary: {
      configured: false,
      reason: 'Mastra eval persistence and experiment registry are not implemented yet.',
      totalDatasets: 0,
      totalExperiments: 0,
    },
  }
}

/**
 * 提供 AI evals 面板的 contract-first 骨架。
 *
 * 当前仓库尚未引入 Eval 持久化表和实验注册，因此这里先返回稳定的空列表与能力摘要，
 * 让前端页面能够按文档路径接入，而不是继续依赖不存在的接口。
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
    description:
      'Returns the current eval registry skeleton. Persisted datasets and experiments land in Phase 5.',
  })
  .input(listAiEvalsInputSchema)
  .output(aiEvalListResponseSchema)
  .handler(async ({ input }) => listAiEvals(input))
