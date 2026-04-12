import type {
  ActivatePromptVersionInput,
  AttachPromptEvalEvidenceInput,
  CreatePromptVersionInput,
  GetPromptVersionCompareInput,
  PromptEvalEvidence,
  PromptReleasePolicy,
  PromptTextDiff,
  PromptVersionCompare,
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

export class PromptCompareMismatchError extends Error {
  constructor(currentPromptKey: string, baselinePromptKey: string) {
    super(
      `Prompt compare requires the same promptKey, got ${currentPromptKey} and ${baselinePromptKey}`,
    )
    this.name = 'PromptCompareMismatchError'
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

/**
 * 将 Prompt 正文按行归一化，便于生成稳定的版本差异摘要。
 */
function normalizePromptTextLines(promptText: string): string[] {
  return promptText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * 计算 Prompt 正文逐行差异摘要，避免在治理页面重复实现相同逻辑。
 */
function buildPromptTextDiff(currentText: string, previousText: string): PromptTextDiff {
  const currentLines = normalizePromptTextLines(currentText)
  const previousLines = normalizePromptTextLines(previousText)
  const previousLineCount = new Map<string, number>()

  for (const line of previousLines) {
    previousLineCount.set(line, (previousLineCount.get(line) ?? 0) + 1)
  }

  const currentLineCount = new Map<string, number>()

  for (const line of currentLines) {
    currentLineCount.set(line, (currentLineCount.get(line) ?? 0) + 1)
  }

  const addedLines: string[] = []

  for (const line of currentLines) {
    const currentCount = currentLineCount.get(line) ?? 0
    const previousCount = previousLineCount.get(line) ?? 0

    if (currentCount > previousCount && !addedLines.includes(line)) {
      addedLines.push(line)
    }
  }

  const removedLines: string[] = []

  for (const line of previousLines) {
    const currentCount = currentLineCount.get(line) ?? 0
    const previousCount = previousLineCount.get(line) ?? 0

    if (previousCount > currentCount && !removedLines.includes(line)) {
      removedLines.push(line)
    }
  }

  let unchangedLineCount = 0

  for (const [line, currentCount] of currentLineCount.entries()) {
    const previousCount = previousLineCount.get(line) ?? 0
    unchangedLineCount += Math.min(currentCount, previousCount)
  }

  return {
    addedLines,
    changed: currentText !== previousText,
    removedLines,
    unchangedLineCount,
  }
}

/**
 * 汇总两个 Prompt 版本之间的治理差异，供对比接口与审阅面板复用。
 */
function buildPromptVersionCompare(
  target: PromptVersionEntry,
  baseline: PromptVersionEntry,
): PromptVersionCompare {
  const promptTextDiff = buildPromptTextDiff(target.promptText, baseline.promptText)
  const notesChanged = target.notes !== baseline.notes
  const releasePolicyChanged =
    JSON.stringify(target.releasePolicy) !== JSON.stringify(baseline.releasePolicy)
  const evalEvidenceChanged =
    JSON.stringify(target.evalEvidence) !== JSON.stringify(baseline.evalEvidence)
  const activationChanged =
    target.activatedAt !== baseline.activatedAt ||
    target.activatedByAuthUserId !== baseline.activatedByAuthUserId ||
    target.activatedByRbacUserId !== baseline.activatedByRbacUserId
  const statusChanged = target.status !== baseline.status || target.isActive !== baseline.isActive
  const rollbackChanged = target.rolledBackFromVersionId !== baseline.rolledBackFromVersionId
  const changedFields = [
    ...(promptTextDiff.changed ? ['promptText'] : []),
    ...(notesChanged ? ['notes'] : []),
    ...(releasePolicyChanged ? ['releasePolicy'] : []),
    ...(evalEvidenceChanged ? ['evalEvidence'] : []),
    ...(activationChanged ? ['activation'] : []),
    ...(statusChanged ? ['status'] : []),
    ...(rollbackChanged ? ['rollback'] : []),
  ]

  return {
    baseline,
    diff: {
      activation: {
        changed: activationChanged,
        currentActivatedAt: target.activatedAt,
        currentActivatedByAuthUserId: target.activatedByAuthUserId,
        currentActivatedByRbacUserId: target.activatedByRbacUserId,
        previousActivatedAt: baseline.activatedAt,
        previousActivatedByAuthUserId: baseline.activatedByAuthUserId,
        previousActivatedByRbacUserId: baseline.activatedByRbacUserId,
      },
      evalEvidence: {
        changed: evalEvidenceChanged,
        current: target.evalEvidence,
        previous: baseline.evalEvidence,
      },
      notes: {
        changed: notesChanged,
        current: target.notes,
        previous: baseline.notes,
      },
      promptText: promptTextDiff,
      releasePolicy: {
        changed: releasePolicyChanged,
        current: target.releasePolicy,
        previous: baseline.releasePolicy,
      },
      rollback: {
        changed: rollbackChanged,
        currentRolledBackFromVersionId: target.rolledBackFromVersionId,
        previousRolledBackFromVersionId: baseline.rolledBackFromVersionId,
      },
      status: {
        changed: statusChanged,
        currentIsActive: target.isActive,
        currentStatus: target.status,
        previousIsActive: baseline.isActive,
        previousStatus: baseline.status,
      },
    },
    summary: {
      changedFields,
      promptKey: target.promptKey,
      totalChangedFields: changedFields.length,
      versionDelta: target.version - baseline.version,
    },
    target,
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
 * 按版本主键读取两个 Prompt 版本的治理差异，要求二者属于同一 promptKey。
 */
export async function comparePromptVersionsById(
  input: GetPromptVersionCompareInput,
  database: Database = db,
): Promise<PromptVersionCompare> {
  const target = await getPromptVersionById(input.id, database)
  const baseline = await getPromptVersionById(input.baselineId, database)

  if (!target) {
    throw new PromptVersionNotFoundError(input.id)
  }

  if (!baseline) {
    throw new PromptVersionNotFoundError(input.baselineId)
  }

  if (target.promptKey !== baseline.promptKey) {
    throw new PromptCompareMismatchError(target.promptKey, baseline.promptKey)
  }

  return buildPromptVersionCompare(target, baseline)
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
