import {
  activatePromptVersion,
  attachPromptEvalEvidence,
  comparePromptVersionsById,
  createPromptVersion,
  getPromptRollbackChainByPromptKey,
  getPromptVersionById,
  getPromptVersionHistoryByPromptKey,
  listOperationLogsByModuleAndRequestInfoValue,
  listOperationLogsByModuleAndTargetId,
  listPromptVersions,
  PromptActiveVersionNotFoundError,
  PromptCompareMismatchError,
  PromptEvalRunNotFoundError,
  PromptReleaseGateError,
  PromptRollbackTargetNotFoundError,
  PromptVersionNotFoundError,
  rollbackPromptVersion,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type ActivatePromptVersionInput,
  type AttachPromptEvalEvidenceInput,
  activatePromptVersionInputSchema,
  attachPromptEvalEvidenceInputSchema,
  type CreatePromptVersionInput,
  createPromptVersionInputSchema,
  type GetPromptGovernanceFailureAuditInput,
  type GetPromptReleaseAuditInput,
  type GetPromptRollbackChainInput,
  type GetPromptVersionByIdInput,
  type GetPromptVersionCompareInput,
  type GetPromptVersionHistoryInput,
  getPromptGovernanceFailureAuditInputSchema,
  getPromptReleaseAuditInputSchema,
  getPromptRollbackChainInputSchema,
  getPromptVersionByIdInputSchema,
  getPromptVersionCompareInputSchema,
  getPromptVersionHistoryInputSchema,
  type PromptGovernanceFailureAudit,
  type PromptGovernanceFailureKind,
  type PromptReleaseAudit,
  type PromptRollbackChain,
  type PromptVersionCompare,
  type PromptVersionDetail,
  type PromptVersionEntry,
  type PromptVersionHistory,
  type PromptVersionListInput,
  type PromptVersionListResponse,
  promptGovernanceFailureAuditSchema,
  promptReleaseAuditSchema,
  promptRollbackChainSchema,
  promptVersionCompareSchema,
  promptVersionDetailSchema,
  promptVersionEntrySchema,
  promptVersionHistorySchema,
  promptVersionListInputSchema,
  promptVersionListResponseSchema,
  type RollbackPromptVersionInput,
  rollbackPromptVersionInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'

import { requireAnyPermission } from '@/orpc/procedures'

interface PromptMutationContext {
  actorAuthUserId: string
  actorRbacUserId: string | null
  requestId: string
}

type PromptGovernanceAction =
  | 'activate_prompt_version'
  | 'attach_prompt_eval_evidence'
  | 'create_prompt_version'
  | 'rollback_prompt_version'

interface PromptGovernanceFailureLogInput {
  action: PromptGovernanceAction
  evalRunId?: string | null
  promptKey?: string | null
  promptVersionId?: string | null
  targetVersionId?: string | null
}

const promptReadPermissions = [
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'AiKnowledge' },
] as const

const promptWritePermissions = [
  { action: 'manage', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'all' },
] as const

function mapPromptGovernanceError(error: unknown): never {
  if (
    error instanceof PromptVersionNotFoundError ||
    error instanceof PromptEvalRunNotFoundError ||
    error instanceof PromptReleaseGateError ||
    error instanceof PromptRollbackTargetNotFoundError ||
    error instanceof PromptActiveVersionNotFoundError ||
    error instanceof PromptCompareMismatchError
  ) {
    throw new ORPCError('BAD_REQUEST', {
      message: error.message,
    })
  }

  throw error
}

/**
 * 判断失败是否属于已知的治理拒绝，而不是未知运行时异常。
 */
function isPromptGovernanceRejectedError(error: unknown): boolean {
  return (
    error instanceof PromptVersionNotFoundError ||
    error instanceof PromptEvalRunNotFoundError ||
    error instanceof PromptReleaseGateError ||
    error instanceof PromptRollbackTargetNotFoundError ||
    error instanceof PromptActiveVersionNotFoundError ||
    error instanceof PromptCompareMismatchError
  )
}

/**
 * 提取失败日志要使用的失败类型，确保拒绝和异常在审计面可区分。
 */
function resolvePromptGovernanceFailureKind(error: unknown): PromptGovernanceFailureKind {
  return isPromptGovernanceRejectedError(error) ? 'rejection' : 'exception'
}

/**
 * 将失败类型收敛到稳定的 action 命名，避免和成功路径的审计动作混淆。
 */
function buildPromptGovernanceFailureAction(
  action: PromptGovernanceAction,
  failureKind: PromptGovernanceFailureKind,
): string {
  return failureKind === 'rejection' ? `${action}_rejected` : `${action}_exception`
}

/**
 * 提取稳定失败代码，供后续治理页和告警规则做聚合。
 */
function resolvePromptGovernanceFailureCode(error: unknown): string {
  if (error instanceof Error && error.name.length > 0) {
    return error.name
  }

  return 'UnknownPromptGovernanceError'
}

/**
 * 在失败路径尽量补全 promptKey，保证 key-scoped 治理审计合同能够聚合完整失败链路。
 */
async function resolvePromptGovernanceFailurePromptKey(
  input: PromptGovernanceFailureLogInput,
): Promise<string | null> {
  if (input.promptKey) {
    return input.promptKey
  }

  const candidateVersionId = input.promptVersionId ?? input.targetVersionId ?? null

  if (!candidateVersionId) {
    return null
  }

  const promptVersion = await getPromptVersionById(candidateVersionId)

  return promptVersion?.promptKey ?? null
}

/**
 * 失败审计采用 best-effort 写入，避免日志故障反向打断治理主流程。
 */
async function writePromptGovernanceFailureLog(
  input: PromptGovernanceFailureLogInput,
  error: unknown,
  context: PromptMutationContext,
): Promise<void> {
  const failureKind = resolvePromptGovernanceFailureKind(error)
  const failureCode = resolvePromptGovernanceFailureCode(error)
  const errorMessage = error instanceof Error ? error.message : 'Unknown prompt governance error'

  try {
    const promptKey = await resolvePromptGovernanceFailurePromptKey(input)

    await writeOperationLog({
      action: buildPromptGovernanceFailureAction(input.action, failureKind),
      detail: `Prompt governance action ${input.action} was ${failureKind} for ${promptKey ?? 'unknown_prompt'}.`,
      errorMessage,
      fallbackActorKind: 'anonymous',
      module: 'ai_prompts',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        evalRunId: input.evalRunId ?? null,
        failureCode,
        failureKind,
        originalAction: input.action,
        promptKey,
        promptVersionId: input.promptVersionId ?? null,
        requestId: context.requestId,
        targetVersionId: input.targetVersionId ?? null,
      },
      status: 'error',
      targetId: input.promptVersionId ?? input.targetVersionId ?? null,
    })
  } catch (operationLogError) {
    const operationLogMessage =
      operationLogError instanceof Error ? operationLogError.message : 'Unknown operation log error'
    console.error(
      `Failed to persist prompt governance failure operation log for ${input.action}: ${operationLogMessage}`,
    )
  }
}

/**
 * 从失败审计条目中恢复原始动作，兼容旧日志没有 requestInfo.originalAction 的情况。
 */
function resolvePromptGovernanceOriginalAction(
  action: string,
  requestInfo: Record<string, string> | null,
): string {
  const requestInfoOriginalAction = requestInfo?.originalAction

  if (requestInfoOriginalAction) {
    return requestInfoOriginalAction
  }

  return action.replace(/_(rejected|exception)$/u, '')
}

/**
 * 从 requestInfo 或 action 后缀中恢复失败类型，保证旧条目也能被正确聚合。
 */
function resolvePromptGovernanceFailureKindFromLogEntry(
  action: string,
  requestInfo: Record<string, string> | null,
): PromptGovernanceFailureKind {
  const requestInfoFailureKind = requestInfo?.failureKind

  if (requestInfoFailureKind === 'exception' || requestInfoFailureKind === 'rejection') {
    return requestInfoFailureKind
  }

  return action.endsWith('_exception') ? 'exception' : 'rejection'
}

/**
 * 对比两个 Prompt 版本的治理差异，供版本审阅与发布前检查使用。
 */
export async function getPromptVersionCompareEntry(
  input: GetPromptVersionCompareInput,
): Promise<PromptVersionCompare> {
  try {
    return await comparePromptVersionsById(input)
  } catch (error) {
    mapPromptGovernanceError(error)
  }
}

/**
 * 读取指定 Prompt 治理键的完整发布历史，供版本时间线与回滚审阅使用。
 */
export async function getPromptVersionHistoryEntry(
  input: GetPromptVersionHistoryInput,
): Promise<PromptVersionHistory> {
  return getPromptVersionHistoryByPromptKey(input)
}

/**
 * 读取指定 Prompt 治理键的回滚链路，供治理页查看来源版本与目标版本关系。
 */
export async function getPromptRollbackChainEntry(
  input: GetPromptRollbackChainInput,
): Promise<PromptRollbackChain> {
  return getPromptRollbackChainByPromptKey(input)
}

/**
 * 读取指定 Prompt 版本的发布审批审计，供治理页查看证据绑定、激活与回滚命中轨迹。
 */
export async function getPromptReleaseAuditEntry(
  input: GetPromptReleaseAuditInput,
): Promise<PromptReleaseAudit> {
  const promptVersion = await getPromptVersionEntryById({
    id: input.id,
  })
  const auditTrail = await listOperationLogsByModuleAndTargetId('ai_prompts', input.id)
  const latestAuditEntry = auditTrail[0] ?? null

  return {
    auditTrail: auditTrail.map((entry) => ({
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      detail: entry.detail,
      errorMessage: entry.errorMessage,
      id: entry.id,
      module: entry.module,
      operatorId: entry.operatorId,
      requestId: entry.requestInfo?.requestId ?? null,
      requestInfo: entry.requestInfo,
      status: entry.status,
      targetId: entry.targetId,
    })),
    promptVersion,
    summary: {
      approvalEventCount: auditTrail.length,
      hasActivation: auditTrail.some((entry) => entry.action === 'activate_prompt_version'),
      hasEvalEvidenceAttachment: auditTrail.some(
        (entry) => entry.action === 'attach_prompt_eval_evidence',
      ),
      hasRollbackTargeted: auditTrail.some((entry) => entry.action === 'rollback_prompt_version'),
      latestAction: latestAuditEntry?.action ?? null,
      latestRequestId: latestAuditEntry?.requestInfo?.requestId ?? null,
    },
  }
}

/**
 * 读取指定 Prompt 治理键的失败审计，聚合门禁拒绝与运行时异常，供治理页排查失败原因。
 */
export async function getPromptGovernanceFailureAuditEntry(
  input: GetPromptGovernanceFailureAuditInput,
): Promise<PromptGovernanceFailureAudit> {
  const auditTrail = await listOperationLogsByModuleAndRequestInfoValue(
    'ai_prompts',
    'promptKey',
    input.promptKey,
    {
      status: 'error',
    },
  )

  const normalizedAuditTrail = auditTrail.map((entry) => {
    const failureKind = resolvePromptGovernanceFailureKindFromLogEntry(
      entry.action,
      entry.requestInfo,
    )

    return {
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      detail: entry.detail,
      errorMessage: entry.errorMessage,
      failureKind,
      id: entry.id,
      module: entry.module,
      operatorId: entry.operatorId,
      originalAction: resolvePromptGovernanceOriginalAction(entry.action, entry.requestInfo),
      requestId: entry.requestInfo?.requestId ?? null,
      requestInfo: entry.requestInfo,
      status: entry.status,
      targetId: entry.targetId,
    }
  })
  const latestFailureEntry = normalizedAuditTrail[0] ?? null
  const rejectionEventCount = normalizedAuditTrail.filter(
    (entry) => entry.failureKind === 'rejection',
  ).length
  const exceptionEventCount = normalizedAuditTrail.filter(
    (entry) => entry.failureKind === 'exception',
  ).length

  return {
    auditTrail: normalizedAuditTrail,
    promptKey: input.promptKey,
    summary: {
      exceptionEventCount,
      hasReleaseGateRejection: normalizedAuditTrail.some(
        (entry) => entry.requestInfo?.failureCode === 'PromptReleaseGateError',
      ),
      hasUnexpectedException: exceptionEventCount > 0,
      latestFailureAction: latestFailureEntry?.action ?? null,
      latestFailureKind: latestFailureEntry?.failureKind ?? null,
      latestFailureRequestId: latestFailureEntry?.requestInfo?.requestId ?? null,
      rejectionEventCount,
      totalFailureEventCount: normalizedAuditTrail.length,
    },
  }
}

/**
 * 读取单个 Prompt 版本详情，供治理页查看具体版本状态与门禁证据。
 */
export async function getPromptVersionEntryById(
  input: GetPromptVersionByIdInput,
): Promise<PromptVersionDetail> {
  const promptVersionEntry = await getPromptVersionById(input.id)

  if (!promptVersionEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Prompt version not found',
    })
  }

  return promptVersionEntry
}

/**
 * 读取 Prompt 版本分页列表，供治理面板展示版本状态与发布就绪性。
 */
export async function listPromptVersionEntries(
  input: PromptVersionListInput,
): Promise<PromptVersionListResponse> {
  return listPromptVersions(input)
}

/**
 * 创建新的 Prompt 草稿版本，并记录治理操作日志。
 */
export async function createPromptVersionEntry(
  input: CreatePromptVersionInput,
  context: PromptMutationContext,
): Promise<PromptVersionEntry> {
  try {
    const promptVersionEntry = await createPromptVersion({
      ...input,
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
    })

    await writeOperationLog({
      action: 'create_prompt_version',
      detail: `Created prompt ${promptVersionEntry.promptKey} version ${promptVersionEntry.version}.`,
      fallbackActorKind: 'anonymous',
      module: 'ai_prompts',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        promptKey: promptVersionEntry.promptKey,
        promptVersionId: promptVersionEntry.id,
        requestId: context.requestId,
      },
      targetId: promptVersionEntry.id,
    })

    return promptVersionEntry
  } catch (error) {
    await writePromptGovernanceFailureLog(
      {
        action: 'create_prompt_version',
        promptKey: input.promptKey,
      },
      error,
      context,
    )
    mapPromptGovernanceError(error)
  }
}

/**
 * 绑定评估运行证据到 Prompt 版本，作为激活门禁的输入。
 */
export async function attachPromptVersionEvalEvidence(
  input: AttachPromptEvalEvidenceInput,
  context: PromptMutationContext,
): Promise<PromptVersionEntry> {
  try {
    const promptVersionEntry = await attachPromptEvalEvidence({
      ...input,
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
    })

    await writeOperationLog({
      action: 'attach_prompt_eval_evidence',
      detail: `Attached eval run ${input.evalRunId} to prompt ${promptVersionEntry.promptKey} version ${promptVersionEntry.version}.`,
      fallbackActorKind: 'anonymous',
      module: 'ai_prompts',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        evalRunId: input.evalRunId,
        promptVersionId: input.promptVersionId,
        requestId: context.requestId,
      },
      targetId: promptVersionEntry.id,
    })

    return promptVersionEntry
  } catch (error) {
    await writePromptGovernanceFailureLog(
      {
        action: 'attach_prompt_eval_evidence',
        evalRunId: input.evalRunId,
        promptVersionId: input.promptVersionId,
      },
      error,
      context,
    )
    mapPromptGovernanceError(error)
  }
}

/**
 * 按发布门禁激活 Prompt 版本，未满足评测阈值时拒绝激活。
 */
export async function activatePromptVersionEntry(
  input: ActivatePromptVersionInput,
  context: PromptMutationContext,
): Promise<PromptVersionEntry> {
  try {
    const promptVersionEntry = await activatePromptVersion({
      ...input,
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
    })

    await writeOperationLog({
      action: 'activate_prompt_version',
      detail: `Activated prompt ${promptVersionEntry.promptKey} version ${promptVersionEntry.version}.`,
      fallbackActorKind: 'anonymous',
      module: 'ai_prompts',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        promptVersionId: promptVersionEntry.id,
        requestId: context.requestId,
      },
      targetId: promptVersionEntry.id,
    })

    return promptVersionEntry
  } catch (error) {
    await writePromptGovernanceFailureLog(
      {
        action: 'activate_prompt_version',
        promptVersionId: input.promptVersionId,
      },
      error,
      context,
    )
    mapPromptGovernanceError(error)
  }
}

/**
 * 将 Prompt 回滚到历史可发布版本，并记录回滚操作轨迹。
 */
export async function rollbackPromptVersionEntry(
  input: RollbackPromptVersionInput,
  context: PromptMutationContext,
): Promise<PromptVersionEntry> {
  try {
    const promptVersionEntry = await rollbackPromptVersion({
      ...input,
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
    })

    await writeOperationLog({
      action: 'rollback_prompt_version',
      detail: `Rolled back prompt ${promptVersionEntry.promptKey} to version ${promptVersionEntry.version}.`,
      fallbackActorKind: 'anonymous',
      module: 'ai_prompts',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        promptKey: input.promptKey,
        requestId: context.requestId,
        targetVersionId: input.targetVersionId ?? null,
      },
      targetId: promptVersionEntry.id,
    })

    return promptVersionEntry
  } catch (error) {
    await writePromptGovernanceFailureLog(
      {
        action: 'rollback_prompt_version',
        promptKey: input.promptKey,
        targetVersionId: input.targetVersionId ?? null,
      },
      error,
      context,
    )
    mapPromptGovernanceError(error)
  }
}

export const aiPromptsListProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts',
    tags: ['AI:Prompts'],
    summary: '分页查询 Prompt 版本',
    description: '返回 Prompt 治理版本列表、发布门禁状态和汇总信息。',
  })
  .input(promptVersionListInputSchema)
  .output(promptVersionListResponseSchema)
  .handler(async ({ input }) => listPromptVersionEntries(input))

export const aiPromptsGetByIdProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/:id',
    tags: ['AI:Prompts'],
    summary: '读取单个 Prompt 版本详情',
    description: '返回单个 Prompt 版本的具体内容、评测证据、门禁状态和回滚关系。',
  })
  .input(getPromptVersionByIdInputSchema)
  .output(promptVersionDetailSchema)
  .handler(async ({ input }) => getPromptVersionEntryById(input))

export const aiPromptsReleaseAuditProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/:id/release-audit',
    tags: ['AI:Prompts'],
    summary: '读取 Prompt 发布审批审计',
    description: '返回指定 Prompt 版本的审批摘要、版本详情和完整审批审计轨迹。',
  })
  .input(getPromptReleaseAuditInputSchema)
  .output(promptReleaseAuditSchema)
  .handler(async ({ input }) => getPromptReleaseAuditEntry(input))

export const aiPromptsFailureAuditProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/failure-audit/:promptKey',
    tags: ['AI:Prompts'],
    summary: '读取 Prompt 治理失败审计',
    description: '返回指定 Prompt 治理键下的拒绝事件、异常事件和失败审计汇总。',
  })
  .input(getPromptGovernanceFailureAuditInputSchema)
  .output(promptGovernanceFailureAuditSchema)
  .handler(async ({ input }) => getPromptGovernanceFailureAuditEntry(input))

export const aiPromptsCompareProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/:id/compare/:baselineId',
    tags: ['AI:Prompts'],
    summary: '对比两个 Prompt 版本',
    description: '返回两个同一 Prompt 治理键版本之间的正文差异、门禁差异和状态差异。',
  })
  .input(getPromptVersionCompareInputSchema)
  .output(promptVersionCompareSchema)
  .handler(async ({ input }) => getPromptVersionCompareEntry(input))

export const aiPromptsHistoryProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/history/:promptKey',
    tags: ['AI:Prompts'],
    summary: '读取 Prompt 发布历史',
    description: '返回指定 Prompt 治理键的完整版本时间线、当前激活版本和发布就绪统计。',
  })
  .input(getPromptVersionHistoryInputSchema)
  .output(promptVersionHistorySchema)
  .handler(async ({ input }) => getPromptVersionHistoryEntry(input))

export const aiPromptsRollbackChainProcedure = requireAnyPermission(promptReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/prompts/rollback-chain/:promptKey',
    tags: ['AI:Prompts'],
    summary: '读取 Prompt 回滚链路',
    description: '返回指定 Prompt 治理键的回滚事件、来源版本和目标版本关系。',
  })
  .input(getPromptRollbackChainInputSchema)
  .output(promptRollbackChainSchema)
  .handler(async ({ input }) => getPromptRollbackChainEntry(input))

export const aiPromptsCreateProcedure = requireAnyPermission(promptWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/prompts',
    tags: ['AI:Prompts'],
    summary: '创建 Prompt 草稿版本',
    description: '创建新的 Prompt 治理草稿版本，供后续评测、激活和回滚流程使用。',
  })
  .input(createPromptVersionInputSchema)
  .output(promptVersionEntrySchema)
  .handler(async ({ context, input }) =>
    createPromptVersionEntry(input, {
      actorAuthUserId: context.userId,
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

export const aiPromptsAttachEvidenceProcedure = requireAnyPermission(promptWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/prompts/attach-evidence',
    tags: ['AI:Prompts'],
    summary: '绑定 Prompt 评测证据',
    description: '把已完成的评测运行绑定到 Prompt 版本，供发布门禁判断是否可激活。',
  })
  .input(attachPromptEvalEvidenceInputSchema)
  .output(promptVersionEntrySchema)
  .handler(async ({ context, input }) =>
    attachPromptVersionEvalEvidence(input, {
      actorAuthUserId: context.userId,
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

export const aiPromptsActivateProcedure = requireAnyPermission(promptWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/prompts/activate',
    tags: ['AI:Prompts'],
    summary: '激活 Prompt 版本',
    description: '仅当绑定评测证据满足发布策略阈值时，才允许激活指定 Prompt 版本。',
  })
  .input(activatePromptVersionInputSchema)
  .output(promptVersionEntrySchema)
  .handler(async ({ context, input }) =>
    activatePromptVersionEntry(input, {
      actorAuthUserId: context.userId,
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

export const aiPromptsRollbackProcedure = requireAnyPermission(promptWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/prompts/rollback',
    tags: ['AI:Prompts'],
    summary: '回滚 Prompt 版本',
    description: '将当前 Prompt 回滚到较早的可发布版本，并记录回滚链路。',
  })
  .input(rollbackPromptVersionInputSchema)
  .output(promptVersionEntrySchema)
  .handler(async ({ context, input }) =>
    rollbackPromptVersionEntry(input, {
      actorAuthUserId: context.userId,
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

export type PromptGovernanceError =
  | PromptVersionNotFoundError
  | PromptEvalRunNotFoundError
  | PromptReleaseGateError
  | PromptRollbackTargetNotFoundError
  | PromptActiveVersionNotFoundError
  | PromptCompareMismatchError
