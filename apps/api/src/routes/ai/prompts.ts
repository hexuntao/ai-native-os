import {
  activatePromptVersion,
  attachPromptEvalEvidence,
  createPromptVersion,
  listPromptVersions,
  PromptActiveVersionNotFoundError,
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
  type PromptVersionEntry,
  type PromptVersionListInput,
  type PromptVersionListResponse,
  promptVersionEntrySchema,
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
    error instanceof PromptActiveVersionNotFoundError
  ) {
    throw new ORPCError('BAD_REQUEST', {
      message: error.message,
    })
  }

  throw error
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
    summary: 'List AI prompt versions',
    description: 'Returns prompt version records together with release-gate readiness summary.',
  })
  .input(promptVersionListInputSchema)
  .output(promptVersionListResponseSchema)
  .handler(async ({ input }) => listPromptVersionEntries(input))

export const aiPromptsCreateProcedure = requireAnyPermission(promptWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/prompts',
    tags: ['AI:Prompts'],
    summary: 'Create AI prompt version',
    description: 'Creates a new prompt draft version for governance and evaluation.',
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
    summary: 'Attach eval evidence to prompt version',
    description:
      'Binds a completed eval run to a prompt version so release gates can be evaluated.',
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
    summary: 'Activate AI prompt version',
    description:
      'Activates a prompt version only when its attached eval evidence satisfies release policy thresholds.',
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
    summary: 'Rollback AI prompt version',
    description:
      'Rolls back an active prompt to an earlier releasable version and records rollback lineage.',
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
