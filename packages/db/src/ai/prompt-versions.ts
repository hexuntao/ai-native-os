import type {
  ActivatePromptVersionInput,
  AttachPromptEvalEvidenceInput,
  CreatePromptVersionInput,
  PromptEvalEvidence,
  PromptReleasePolicy,
  PromptVersionEntry,
  PromptVersionListInput,
  PromptVersionListResponse,
  PromptVersionStatus,
  RollbackPromptVersionInput,
} from '@ai-native-os/shared'
import { and, desc, eq, max, sql } from 'drizzle-orm'

import { type Database, db } from '../client'
import { aiEvalRuns, aiPromptVersions } from '../schema'

export class PromptVersionNotFoundError extends Error {
  constructor(promptVersionId: string) {
    super(`Prompt version ${promptVersionId} does not exist`)
    this.name = 'PromptVersionNotFoundError'
  }
}

export class PromptEvalRunNotFoundError extends Error {
  constructor(evalRunId: string) {
    super(`Eval run ${evalRunId} does not exist`)
    this.name = 'PromptEvalRunNotFoundError'
  }
}

export class PromptReleaseGateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptReleaseGateError'
  }
}

export class PromptRollbackTargetNotFoundError extends Error {
  constructor(promptKey: string) {
    super(`No rollback target exists for prompt ${promptKey}`)
    this.name = 'PromptRollbackTargetNotFoundError'
  }
}

export class PromptActiveVersionNotFoundError extends Error {
  constructor(promptKey: string) {
    super(`No active prompt version exists for prompt ${promptKey}`)
    this.name = 'PromptActiveVersionNotFoundError'
  }
}

interface PromptReleaseEvaluation {
  ready: boolean
  reason: string | null
}

function normalizeNullableText(value: string | undefined): string | null {
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : null
}

function evaluatePromptReleaseGate(
  policy: PromptReleasePolicy,
  evidence: PromptEvalEvidence | null,
): PromptReleaseEvaluation {
  if (!evidence) {
    return {
      ready: false,
      reason: 'missing eval evidence',
    }
  }

  if (evidence.status !== 'completed') {
    return {
      ready: false,
      reason: `eval status must be completed, got ${evidence.status}`,
    }
  }

  if (evidence.scoreAverage === null) {
    return {
      ready: false,
      reason: 'eval scoreAverage is missing',
    }
  }

  if (evidence.scoreAverage < policy.minAverageScore) {
    return {
      ready: false,
      reason: `eval scoreAverage ${evidence.scoreAverage.toFixed(3)} is below threshold ${policy.minAverageScore.toFixed(3)}`,
    }
  }

  for (const [scorerId, threshold] of Object.entries(policy.scorerThresholds)) {
    const scorerAverage = evidence.scorerSummary[scorerId]?.averageScore

    if (scorerAverage === null || scorerAverage === undefined) {
      return {
        ready: false,
        reason: `scorer ${scorerId} has no average score`,
      }
    }

    if (scorerAverage < threshold) {
      return {
        ready: false,
        reason: `scorer ${scorerId} average ${scorerAverage.toFixed(3)} is below threshold ${threshold.toFixed(3)}`,
      }
    }
  }

  return {
    ready: true,
    reason: null,
  }
}

function mapPromptVersionRow(row: typeof aiPromptVersions.$inferSelect): PromptVersionEntry {
  const releaseEvaluation = evaluatePromptReleaseGate(row.releasePolicy, row.evalEvidence ?? null)

  return {
    activatedAt: row.activatedAt?.toISOString() ?? null,
    activatedByAuthUserId: row.activatedByAuthUserId ?? null,
    activatedByRbacUserId: row.activatedByRbacUserId,
    createdAt: row.createdAt.toISOString(),
    createdByAuthUserId: row.createdByAuthUserId,
    createdByRbacUserId: row.createdByRbacUserId,
    evalEvidence: row.evalEvidence ?? null,
    id: row.id,
    isActive: row.isActive,
    notes: row.notes,
    promptKey: row.promptKey,
    promptText: row.promptText,
    releasePolicy: row.releasePolicy,
    releaseReady: releaseEvaluation.ready,
    releaseReason: releaseEvaluation.reason,
    rolledBackFromVersionId: row.rolledBackFromVersionId,
    status: row.status as PromptVersionStatus,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  }
}

function createPromptEvalEvidenceFromRun(row: typeof aiEvalRuns.$inferSelect): PromptEvalEvidence {
  return {
    completedAt: row.completedAt?.toISOString() ?? null,
    evalKey: row.evalKey,
    evalRunId: row.id,
    experimentId: row.experimentId,
    scoreAverage: row.scoreAverage,
    scorerSummary: row.scorerSummary,
    status: row.status as PromptEvalEvidence['status'],
  }
}

async function getPromptVersionRowById(
  promptVersionId: string,
  database: Database,
): Promise<typeof aiPromptVersions.$inferSelect> {
  const [row] = await database
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.id, promptVersionId))
    .limit(1)

  if (!row) {
    throw new PromptVersionNotFoundError(promptVersionId)
  }

  return row
}

/**
 * 按主键读取单个 Prompt 版本，供治理详情页和 API 详情接口复用。
 */
export async function getPromptVersionById(
  promptVersionId: string,
  database: Database = db,
): Promise<PromptVersionEntry | null> {
  const [row] = await database
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.id, promptVersionId))
    .limit(1)

  return row ? mapPromptVersionRow(row) : null
}

/**
 * 创建新的 prompt 草稿版本，默认不激活。
 */
export async function createPromptVersion(
  input: CreatePromptVersionInput & {
    actorAuthUserId: string
    actorRbacUserId: string | null
  },
  database: Database = db,
): Promise<PromptVersionEntry> {
  const latestVersionRow = await database
    .select({
      latestVersion: max(aiPromptVersions.version),
    })
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptKey, input.promptKey))
  const nextVersion = (latestVersionRow[0]?.latestVersion ?? 0) + 1
  const [createdRow] = await database
    .insert(aiPromptVersions)
    .values({
      createdByAuthUserId: input.actorAuthUserId,
      createdByRbacUserId: input.actorRbacUserId,
      notes: normalizeNullableText(input.notes),
      promptKey: input.promptKey,
      promptText: input.promptText,
      releasePolicy: input.releasePolicy,
      status: 'draft',
      version: nextVersion,
    })
    .returning()

  if (!createdRow) {
    throw new Error(`Failed to create prompt version for prompt ${input.promptKey}`)
  }

  return mapPromptVersionRow(createdRow)
}

/**
 * 读取 prompt 版本分页列表，并附带 release-ready 汇总信息。
 */
export async function listPromptVersions(
  input: PromptVersionListInput,
  database: Database = db,
): Promise<PromptVersionListResponse> {
  const filters = []

  if (input.promptKey) {
    filters.push(eq(aiPromptVersions.promptKey, input.promptKey))
  }

  if (input.status) {
    filters.push(eq(aiPromptVersions.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const rows = await database
    .select()
    .from(aiPromptVersions)
    .where(where)
    .orderBy(desc(aiPromptVersions.createdAt), desc(aiPromptVersions.version))
  const mappedRows = rows.map(mapPromptVersionRow)
  const offset = (input.page - 1) * input.pageSize
  const pageRows = mappedRows.slice(offset, offset + input.pageSize)

  return {
    data: pageRows,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: mappedRows.length,
      totalPages: Math.max(1, Math.ceil(mappedRows.length / input.pageSize)),
    },
    summary: {
      activeCount: mappedRows.filter((row) => row.status === 'active').length,
      draftCount: mappedRows.filter((row) => row.status === 'draft').length,
      releaseReadyCount: mappedRows.filter((row) => row.releaseReady).length,
    },
  }
}

/**
 * 将指定 eval run 的评分结果绑定到 prompt 版本，作为激活门禁证据。
 */
export async function attachPromptEvalEvidence(
  input: AttachPromptEvalEvidenceInput & {
    actorAuthUserId: string
    actorRbacUserId: string | null
  },
  database: Database = db,
): Promise<PromptVersionEntry> {
  const promptVersionRow = await getPromptVersionRowById(input.promptVersionId, database)
  const [evalRunRow] = await database
    .select()
    .from(aiEvalRuns)
    .where(eq(aiEvalRuns.id, input.evalRunId))
    .limit(1)

  if (!evalRunRow) {
    throw new PromptEvalRunNotFoundError(input.evalRunId)
  }

  const [updatedRow] = await database
    .update(aiPromptVersions)
    .set({
      evalEvidence: createPromptEvalEvidenceFromRun(evalRunRow),
      notes:
        promptVersionRow.notes ??
        `Eval evidence attached by ${input.actorAuthUserId} (${input.actorRbacUserId ?? 'no-rbac-user'})`,
      updatedAt: new Date(),
    })
    .where(eq(aiPromptVersions.id, input.promptVersionId))
    .returning()

  if (!updatedRow) {
    throw new Error(`Failed to attach eval evidence to prompt version ${input.promptVersionId}`)
  }

  return mapPromptVersionRow(updatedRow)
}

/**
 * 按 release policy 激活 prompt 版本；无评估证据或评分不达标将被拒绝。
 */
export async function activatePromptVersion(
  input: ActivatePromptVersionInput & {
    actorAuthUserId: string
    actorRbacUserId: string | null
  },
  database: Database = db,
): Promise<PromptVersionEntry> {
  const promptVersionRow = await getPromptVersionRowById(input.promptVersionId, database)
  const releaseEvaluation = evaluatePromptReleaseGate(
    promptVersionRow.releasePolicy,
    promptVersionRow.evalEvidence ?? null,
  )

  if (!releaseEvaluation.ready) {
    throw new PromptReleaseGateError(
      `Prompt ${promptVersionRow.promptKey} version ${promptVersionRow.version} cannot be activated: ${releaseEvaluation.reason}`,
    )
  }

  const activatedAt = new Date()
  const activatedRow = await database.transaction(async (transaction) => {
    await transaction
      .update(aiPromptVersions)
      .set({
        isActive: false,
        status: 'archived',
        updatedAt: activatedAt,
      })
      .where(
        and(
          eq(aiPromptVersions.promptKey, promptVersionRow.promptKey),
          eq(aiPromptVersions.isActive, true),
        ),
      )

    const [updatedRow] = await transaction
      .update(aiPromptVersions)
      .set({
        activatedAt,
        activatedByAuthUserId: input.actorAuthUserId,
        activatedByRbacUserId: input.actorRbacUserId,
        isActive: true,
        rolledBackFromVersionId: null,
        status: 'active',
        updatedAt: activatedAt,
      })
      .where(eq(aiPromptVersions.id, input.promptVersionId))
      .returning()

    if (!updatedRow) {
      throw new Error(`Failed to activate prompt version ${input.promptVersionId}`)
    }

    return updatedRow
  })

  return mapPromptVersionRow(activatedRow)
}

/**
 * 将 prompt 回滚到历史版本，默认回滚到最近一个可发布历史版本。
 */
export async function rollbackPromptVersion(
  input: RollbackPromptVersionInput & {
    actorAuthUserId: string
    actorRbacUserId: string | null
  },
  database: Database = db,
): Promise<PromptVersionEntry> {
  const [activeVersionRow] = await database
    .select()
    .from(aiPromptVersions)
    .where(
      and(eq(aiPromptVersions.promptKey, input.promptKey), eq(aiPromptVersions.isActive, true)),
    )
    .limit(1)

  if (!activeVersionRow) {
    throw new PromptActiveVersionNotFoundError(input.promptKey)
  }

  let targetVersionRow: typeof aiPromptVersions.$inferSelect | undefined

  if (input.targetVersionId) {
    const [explicitTarget] = await database
      .select()
      .from(aiPromptVersions)
      .where(
        and(
          eq(aiPromptVersions.id, input.targetVersionId),
          eq(aiPromptVersions.promptKey, input.promptKey),
        ),
      )
      .limit(1)

    targetVersionRow = explicitTarget
  } else {
    const [latestHistorical] = await database
      .select()
      .from(aiPromptVersions)
      .where(
        and(
          eq(aiPromptVersions.promptKey, input.promptKey),
          sql`${aiPromptVersions.id} <> ${activeVersionRow.id}`,
          sql`${aiPromptVersions.evalEvidence} is not null`,
        ),
      )
      .orderBy(desc(aiPromptVersions.version))
      .limit(1)

    targetVersionRow = latestHistorical
  }

  if (!targetVersionRow) {
    throw new PromptRollbackTargetNotFoundError(input.promptKey)
  }

  const releaseEvaluation = evaluatePromptReleaseGate(
    targetVersionRow.releasePolicy,
    targetVersionRow.evalEvidence ?? null,
  )

  if (!releaseEvaluation.ready) {
    throw new PromptReleaseGateError(
      `Prompt rollback target ${targetVersionRow.id} is not releasable: ${releaseEvaluation.reason}`,
    )
  }

  const activatedAt = new Date()
  const rolledBackRow = await database.transaction(async (transaction) => {
    await transaction
      .update(aiPromptVersions)
      .set({
        isActive: false,
        status: 'archived',
        updatedAt: activatedAt,
      })
      .where(eq(aiPromptVersions.id, activeVersionRow.id))

    const [updatedRow] = await transaction
      .update(aiPromptVersions)
      .set({
        activatedAt,
        activatedByAuthUserId: input.actorAuthUserId,
        activatedByRbacUserId: input.actorRbacUserId,
        isActive: true,
        rolledBackFromVersionId: activeVersionRow.id,
        status: 'active',
        updatedAt: activatedAt,
      })
      .where(eq(aiPromptVersions.id, targetVersionRow.id))
      .returning()

    if (!updatedRow) {
      throw new Error(`Failed to rollback prompt ${input.promptKey} to ${targetVersionRow?.id}`)
    }

    return updatedRow
  })

  return mapPromptVersionRow(rolledBackRow)
}
