import type {
  AiEvalItemScoreMap,
  AiEvalRunStatus,
  AiEvalScorerSummary,
  AiEvalTriggerSource,
} from '@ai-native-os/shared'
import { count, desc, eq, inArray } from 'drizzle-orm'

import { type Database, db } from '../client'
import { aiEvalRunItems, aiEvalRuns } from '../schema'

export interface PersistAiEvalRunItemInput {
  datasetItemId: string
  errorMessage: string | null
  groundTruth: unknown
  input: unknown
  itemIndex: number
  output: unknown
  scores: AiEvalItemScoreMap
}

export interface PersistAiEvalRunInput {
  actorAuthUserId: string
  actorRbacUserId: string | null
  completedAt: Date | null
  datasetId: string
  datasetName: string
  evalKey: string
  evalName: string
  experimentId: string
  failedCount: number
  items: PersistAiEvalRunItemInput[]
  requestId: string | null
  scoreAverage: number | null
  scoreMax: number | null
  scoreMin: number | null
  scorerSummary: AiEvalScorerSummary
  skippedCount: number
  startedAt: Date
  status: AiEvalRunStatus
  succeededCount: number
  totalItems: number
  triggerSource: AiEvalTriggerSource
}

export interface AiEvalRunRecord {
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
  scorerSummary: AiEvalScorerSummary
  skippedCount: number
  startedAt: Date
  status: AiEvalRunStatus
  succeededCount: number
  totalItems: number
  triggerSource: AiEvalTriggerSource
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function mapAiEvalRunRow(row: typeof aiEvalRuns.$inferSelect): AiEvalRunRecord {
  return {
    actorAuthUserId: row.actorAuthUserId,
    actorRbacUserId: row.actorRbacUserId,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    datasetId: row.datasetId,
    datasetName: row.datasetName,
    evalKey: row.evalKey,
    evalName: row.evalName,
    experimentId: row.experimentId,
    failedCount: row.failedCount,
    id: row.id,
    requestId: row.requestId,
    scoreAverage: row.scoreAverage,
    scoreMax: row.scoreMax,
    scoreMin: row.scoreMin,
    scorerSummary: row.scorerSummary,
    skippedCount: row.skippedCount,
    startedAt: row.startedAt,
    status: row.status as AiEvalRunStatus,
    succeededCount: row.succeededCount,
    totalItems: row.totalItems,
    triggerSource: row.triggerSource as AiEvalTriggerSource,
  }
}

/**
 * 持久化一次 Mastra eval 运行结果，并附带逐项 scorer 记录。
 */
export async function persistAiEvalRun(
  input: PersistAiEvalRunInput,
  database: Database = db,
): Promise<AiEvalRunRecord> {
  const runRecord = await database.transaction(async (transaction) => {
    const [runRow] = await transaction
      .insert(aiEvalRuns)
      .values({
        actorAuthUserId: input.actorAuthUserId,
        actorRbacUserId: input.actorRbacUserId,
        completedAt: input.completedAt,
        datasetId: input.datasetId,
        datasetName: input.datasetName,
        evalKey: input.evalKey,
        evalName: input.evalName,
        experimentId: input.experimentId,
        failedCount: input.failedCount,
        requestId: input.requestId,
        scoreAverage: input.scoreAverage,
        scoreMax: input.scoreMax,
        scoreMin: input.scoreMin,
        scorerSummary: input.scorerSummary,
        skippedCount: input.skippedCount,
        startedAt: input.startedAt,
        status: input.status,
        succeededCount: input.succeededCount,
        totalItems: input.totalItems,
        triggerSource: input.triggerSource,
      })
      .returning()

    if (!runRow) {
      throw new Error(`Failed to persist AI eval run ${input.evalKey}`)
    }

    if (input.items.length > 0) {
      await transaction.insert(aiEvalRunItems).values(
        input.items.map((item) => ({
          datasetItemId: item.datasetItemId,
          errorMessage: item.errorMessage,
          groundTruth: sanitizeJsonValue(item.groundTruth),
          input: sanitizeJsonValue(item.input),
          itemIndex: item.itemIndex,
          output: sanitizeJsonValue(item.output),
          runId: runRow.id,
          scores: item.scores,
        })),
      )
    }

    return runRow
  })

  return mapAiEvalRunRow(runRecord)
}

/**
 * 读取所有评估运行记录总数，用于评估面板摘要。
 */
export async function countAiEvalRuns(database: Database = db): Promise<number> {
  const totalRow = await database.select({ total: count() }).from(aiEvalRuns)

  return totalRow[0]?.total ?? 0
}

/**
 * 按评估键读取最近运行记录，供评估列表展示最近运行状态。
 */
export async function listLatestAiEvalRunsByEvalKeys(
  evalKeys: readonly string[],
  database: Database = db,
): Promise<Map<string, AiEvalRunRecord>> {
  if (evalKeys.length === 0) {
    return new Map()
  }

  const rows = await database
    .select()
    .from(aiEvalRuns)
    .where(inArray(aiEvalRuns.evalKey, [...evalKeys]))
    .orderBy(desc(aiEvalRuns.createdAt))

  const latestRunMap = new Map<string, AiEvalRunRecord>()

  for (const row of rows) {
    if (latestRunMap.has(row.evalKey)) {
      continue
    }

    latestRunMap.set(row.evalKey, mapAiEvalRunRow(row))
  }

  return latestRunMap
}

/**
 * 按评估键读取运行记录，主要用于任务与路由测试验证。
 */
export async function listAiEvalRunsByEvalKey(
  evalKey: string,
  database: Database = db,
): Promise<AiEvalRunRecord[]> {
  const rows = await database
    .select()
    .from(aiEvalRuns)
    .where(eq(aiEvalRuns.evalKey, evalKey))
    .orderBy(desc(aiEvalRuns.createdAt))

  return rows.map(mapAiEvalRunRow)
}
