import { listAiEvalRunsByEvalKey, writeOperationLog } from '@ai-native-os/db'
import {
  type AiEvalDetail,
  type AiEvalListResponse,
  type AiEvalRunEntry,
  type AiEvalRunResult,
  aiEvalDetailSchema,
  aiEvalListResponseSchema,
  aiEvalRunResultSchema,
  type GetAiEvalByIdInput,
  getAiEvalByIdInputSchema,
  type ListAiEvalsInput,
  listAiEvalsInputSchema,
  type RunAiEvalInput,
  runAiEvalInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'

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
    throw new ORPCError('NOT_FOUND', {
      message: 'AI eval suite not found',
    })
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
 * 手动触发一次评测套件运行，并记录治理操作日志。
 */
export async function runAiEval(
  input: RunAiEvalInput,
  context: AiEvalMutationContext,
): Promise<AiEvalRunResult> {
  const evalSuite = getMastraEvalSuiteById(input.id)

  if (!evalSuite) {
    throw new ORPCError('NOT_FOUND', {
      message: 'AI eval suite not found',
    })
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
      requestId: context.requestId,
    }),
  )
