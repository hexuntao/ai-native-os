import {
  activatePromptVersion,
  attachPromptEvalEvidence,
  comparePromptVersionsById,
  createPromptVersion,
  getPromptVersionById,
  getPromptVersionHistoryByPromptKey,
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
  type GetPromptVersionByIdInput,
  type GetPromptVersionCompareInput,
  type GetPromptVersionHistoryInput,
  getPromptVersionByIdInputSchema,
  getPromptVersionCompareInputSchema,
  getPromptVersionHistoryInputSchema,
  type PromptVersionCompare,
  type PromptVersionDetail,
  type PromptVersionEntry,
  type PromptVersionHistory,
  type PromptVersionListInput,
  type PromptVersionListResponse,
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
