import {
  getAiEvalRunDetailById,
  listAiEvalRunsByEvalKey,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type AiEvalDetail,
  type AiEvalListResponse,
  type AiEvalRunDetail,
  type AiEvalRunEntry,
  type AiEvalRunItemDetail,
  type AiEvalRunResult,
  aiEvalDetailSchema,
  aiEvalListResponseSchema,
  aiEvalRunDetailSchema,
  aiEvalRunResultSchema,
  type GetAiEvalByIdInput,
  type GetAiEvalRunByIdInput,
  getAiEvalByIdInputSchema,
  getAiEvalRunByIdInputSchema,
  type ListAiEvalsInput,
  listAiEvalsInputSchema,
  type RunAiEvalInput,
  runAiEvalInputSchema,
} from '@ai-native-os/shared'

import { domainNotFoundError } from '@/lib/domain-errors'
import { runIdempotentMutation } from '@/lib/idempotency'
import { getMastraEvalSuiteById } from '@/mastra/evals/registry'
import { buildMastraEvalCatalogSnapshot, runMastraEvalSuite } from '@/mastra/evals/runner'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

interface AiEvalMutationContext {
  actorAuthUserId: string
  actorRbacUserId: string | null
  requestId: string
}

const aiEvalReadPermissions = [
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'AiKnowledge' },
] as const

const aiEvalWritePermissions = [
  { action: 'manage', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'all' },
] as const

/**
 * 将数据库中的评测运行记录序列化为 contract-first 输出结构。
 */
function serializeAiEvalRunEntry(record: {
  actorAuthUserId: string
  actorRbacUserId: string | null
  completedAt: Date | null
  createdAt: Date
  datasetId: string
  datasetName: string
  evalKey: string
  evalName: string
  experimentId: string
  failedCount: number
  id: string
  requestId: string | null
  scoreAverage: number | null
  scoreMax: number | null
  scoreMin: number | null
  scorerSummary: AiEvalRunEntry['scorerSummary']
  skippedCount: number
  startedAt: Date
  status: AiEvalRunEntry['status']
  succeededCount: number
  totalItems: number
  triggerSource: AiEvalRunEntry['triggerSource']
}): AiEvalRunEntry {
  return {
    actorAuthUserId: record.actorAuthUserId,
    actorRbacUserId: record.actorRbacUserId,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    datasetId: record.datasetId,
    datasetName: record.datasetName,
    evalKey: record.evalKey,
    evalName: record.evalName,
    experimentId: record.experimentId,
    failedCount: record.failedCount,
    id: record.id,
    requestId: record.requestId,
    scoreAverage: record.scoreAverage,
    scoreMax: record.scoreMax,
    scoreMin: record.scoreMin,
    scorerSummary: record.scorerSummary,
    skippedCount: record.skippedCount,
    startedAt: record.startedAt.toISOString(),
    status: record.status,
    succeededCount: record.succeededCount,
    totalItems: record.totalItems,
    triggerSource: record.triggerSource,
  }
}

/**
 * 将数据库中的未知 JSON 负载收敛为 OpenAPI 合同允许的稳定 JSON 值。
 */
function normalizeAiEvalJsonPayload(
  value: unknown,
):
  | AiEvalRunItemDetail['input']
  | AiEvalRunItemDetail['output']
  | AiEvalRunItemDetail['groundTruth'] {
  if (value === null) {
    return null
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value)
  ) {
    return value
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>
  }

  return String(value)
}

/**
 * 将数据库中的评测样本运行明细序列化为 contract-first 输出结构。
 */
function serializeAiEvalRunItemDetail(record: {
  createdAt: Date
  datasetItemId: string
  errorMessage: string | null
  groundTruth: unknown
  id: string
  input: unknown
  itemIndex: number
  output: unknown
  runId: string
  scores: AiEvalRunItemDetail['scores']
}): AiEvalRunItemDetail {
  return {
    createdAt: record.createdAt.toISOString(),
    datasetItemId: record.datasetItemId,
    errorMessage: record.errorMessage,
    groundTruth: normalizeAiEvalJsonPayload(record.groundTruth),
    id: record.id,
    input: normalizeAiEvalJsonPayload(record.input),
    itemIndex: record.itemIndex,
    output: normalizeAiEvalJsonPayload(record.output),
    runId: record.runId,
    scores: record.scores,
  }
}

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
 * 读取单个评测套件详情，并补充最近运行记录与环境说明。
 */
export async function getAiEvalById(input: GetAiEvalByIdInput): Promise<AiEvalDetail> {
  const snapshot = await buildMastraEvalCatalogSnapshot()
  const evalEntry = snapshot.entries.find((entry) => entry.id === input.id)

  if (!evalEntry) {
    throw domainNotFoundError('AI_EVAL_NOT_FOUND')
  }

  const recentRuns = await listAiEvalRunsByEvalKey(input.id)

  return {
    backing: 'mastra',
    ...evalEntry,
    environment: {
      configured: snapshot.configured,
      reason: snapshot.reason,
    },
    recentRuns: recentRuns.slice(0, 5).map((runRecord) => serializeAiEvalRunEntry(runRecord)),
  }
}

/**
 * 读取单次评测运行详情，并返回逐样本评分明细供治理页面检查。
 */
export async function getAiEvalRunById(input: GetAiEvalRunByIdInput): Promise<AiEvalRunDetail> {
  const snapshot = await buildMastraEvalCatalogSnapshot()
  const evalEntry = snapshot.entries.find((entry) => entry.id === input.id)

  if (!evalEntry) {
    throw domainNotFoundError('AI_EVAL_NOT_FOUND')
  }

  const runDetail = await getAiEvalRunDetailById(input.id, input.runId)

  if (!runDetail) {
    throw domainNotFoundError('AI_EVAL_RUN_NOT_FOUND')
  }

  return {
    ...serializeAiEvalRunEntry(runDetail.run),
    environment: {
      configured: snapshot.configured,
      reason: snapshot.reason,
    },
    items: runDetail.items.map((record) => serializeAiEvalRunItemDetail(record)),
  }
}

/**
 * 手动触发一次评测套件运行，并记录治理操作日志。
 */
export async function runAiEval(
  input: RunAiEvalInput,
  context: AiEvalMutationContext & {
    idempotencyKey: string | null
  },
): Promise<AiEvalRunResult> {
  return runIdempotentMutation(
    'ai.evals.run',
    input,
    {
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
      idempotencyKey: context.idempotencyKey,
    },
    async () => {
      const evalSuite = getMastraEvalSuiteById(input.id)

      if (!evalSuite) {
        throw domainNotFoundError('AI_EVAL_NOT_FOUND')
      }

      const runResult = await runMastraEvalSuite({
        actorAuthUserId: context.actorAuthUserId,
        actorRbacUserId: context.actorRbacUserId,
        evalId: evalSuite.id,
        requestId: context.requestId,
        triggerSource: 'manual',
      })

      await writeOperationLog({
        action: 'run_ai_eval',
        detail: `Executed AI eval ${runResult.evalId} (${runResult.experimentId}).`,
        fallbackActorKind: 'anonymous',
        module: 'ai_evals',
        operatorId: context.actorRbacUserId,
        requestInfo: {
          evalId: runResult.evalId,
          experimentId: runResult.experimentId,
          requestId: context.requestId,
          status: runResult.status,
        },
        targetId: runResult.experimentId,
      })

      return runResult
    },
  )
}

/**
 * 提供 AI 评估目录与最近运行结果接口。
 */
export const aiEvalsListProcedure = requireAnyPermission(aiEvalReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/evals',
    tags: ['AI:Evals'],
    summary: '分页查询 AI 评测目录',
    description: '返回已注册的评测套件、最近实验结果和当前评测运行环境汇总。',
  })
  .input(listAiEvalsInputSchema)
  .output(aiEvalListResponseSchema)
  .handler(async ({ input }) => listAiEvals(input))

/**
 * 提供单个 AI 评测详情接口，供治理页查看最近运行轨迹。
 */
export const aiEvalsGetByIdProcedure = requireAnyPermission(aiEvalReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/evals/:id',
    tags: ['AI:Evals'],
    summary: '读取单个 AI 评测详情',
    description: '返回单个评测套件的目录信息、最近运行记录和当前运行环境说明。',
  })
  .input(getAiEvalByIdInputSchema)
  .output(aiEvalDetailSchema)
  .handler(async ({ input }) => getAiEvalById(input))

/**
 * 提供单次 AI 评测运行详情接口，供治理页检查样本级评分结果。
 */
export const aiEvalsRunDetailProcedure = requireAnyPermission(aiEvalReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/evals/:id/runs/:runId',
    tags: ['AI:Evals'],
    summary: '读取单次 AI 评测运行详情',
    description: '返回指定评测运行的实验摘要、逐样本评分明细和当前运行环境说明。',
  })
  .input(getAiEvalRunByIdInputSchema)
  .output(aiEvalRunDetailSchema)
  .handler(async ({ input }) => getAiEvalRunById(input))

/**
 * 提供手动触发评测运行接口，供治理页执行一次即时回归检查。
 */
export const aiEvalsRunProcedure = requireAnyPermission(aiEvalWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/evals/:id/run',
    tags: ['AI:Evals'],
    summary: '手动执行 AI 评测',
    description: '手动触发指定评测套件执行一次运行，并返回实验结果摘要。',
  })
  .input(runAiEvalInputSchema)
  .output(aiEvalRunResultSchema)
  .handler(async ({ context, input }) =>
    runAiEval(input, {
      actorAuthUserId: context.userId,
      actorRbacUserId: context.rbacUserId,
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
    }),
  )
