import {
  AiFeedbackAuditLogNotFoundError,
  createAiFeedback,
  getAiAuditLogById,
  getAiFeedbackById,
  listAiFeedback,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type AiFeedbackCreateInput,
  type AiFeedbackDetail,
  type AiFeedbackEntry,
  type AiFeedbackListResponse,
  aiFeedbackDetailSchema,
  aiFeedbackEntrySchema,
  aiFeedbackListResponseSchema,
  createAiFeedbackInputSchema,
  type GetAiFeedbackByIdInput,
  getAiFeedbackByIdInputSchema,
  type ListAiFeedbackInput,
  listAiFeedbackInputSchema,
} from '@ai-native-os/shared'

import { domainNotFoundError } from '@/lib/domain-errors'
import { runIdempotentMutation } from '@/lib/idempotency'
import { requireAnyPermission } from '@/orpc/procedures'

const aiFeedbackPermissions = [
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'all' },
] as const

function serializeAiFeedbackEntry(record: {
  accepted: boolean
  actorAuthUserId: string
  actorRbacUserId: string | null
  auditLogId: string
  correction: string | null
  createdAt: Date
  feedbackText: string | null
  id: string
  userAction: AiFeedbackCreateInput['userAction']
}): AiFeedbackEntry {
  return {
    accepted: record.accepted,
    actorAuthUserId: record.actorAuthUserId,
    actorRbacUserId: record.actorRbacUserId,
    auditLogId: record.auditLogId,
    correction: record.correction,
    createdAt: record.createdAt.toISOString(),
    feedbackText: record.feedbackText,
    id: record.id,
    userAction: record.userAction,
  }
}

/**
 * 读取 AI 反馈分页数据，供监控与人工接管页面展示。
 */
export async function listFeedback(input: ListAiFeedbackInput): Promise<AiFeedbackListResponse> {
  return listAiFeedback(input)
}

/**
 * 读取单条 AI 反馈详情，并补充其对应 AI 审计日志的最小上下文。
 */
export async function getFeedbackById(input: GetAiFeedbackByIdInput): Promise<AiFeedbackDetail> {
  const feedbackRecord = await getAiFeedbackById(input.id)

  if (!feedbackRecord) {
    throw domainNotFoundError('AI_FEEDBACK_NOT_FOUND')
  }

  const auditLogRecord = await getAiAuditLogById(feedbackRecord.auditLogId)

  if (!auditLogRecord) {
    throw domainNotFoundError('AI_AUDIT_LOG_NOT_FOUND')
  }

  return {
    accepted: feedbackRecord.accepted,
    actorAuthUserId: feedbackRecord.actorAuthUserId,
    actorRbacUserId: feedbackRecord.actorRbacUserId,
    auditLog: {
      createdAt: auditLogRecord.createdAt.toISOString(),
      id: auditLogRecord.id,
      requestId: auditLogRecord.requestInfo?.requestId ?? null,
      status: auditLogRecord.status,
      subject: auditLogRecord.subject,
      toolId: auditLogRecord.toolId,
    },
    auditLogId: feedbackRecord.auditLogId,
    correction: feedbackRecord.correction,
    createdAt: feedbackRecord.createdAt.toISOString(),
    feedbackText: feedbackRecord.feedbackText,
    id: feedbackRecord.id,
    userAction: feedbackRecord.userAction,
  }
}

/**
 * 记录一次用户对 AI 建议的采纳、拒绝或人工修正，并同步写入操作日志。
 */
export async function createFeedback(
  input: AiFeedbackCreateInput,
  context: {
    actorAuthUserId: string
    idempotencyKey: string | null
    actorRbacUserId: string | null
    requestId: string
  },
): Promise<AiFeedbackEntry> {
  return runIdempotentMutation(
    'ai.feedback.create',
    input,
    {
      actorAuthUserId: context.actorAuthUserId,
      actorRbacUserId: context.actorRbacUserId,
      idempotencyKey: context.idempotencyKey,
    },
    async () => {
      let feedbackRecord: Awaited<ReturnType<typeof createAiFeedback>>

      try {
        feedbackRecord = await createAiFeedback({
          ...input,
          actorAuthUserId: context.actorAuthUserId,
          actorRbacUserId: context.actorRbacUserId,
        })
      } catch (error) {
        if (error instanceof AiFeedbackAuditLogNotFoundError) {
          throw domainNotFoundError('AI_AUDIT_LOG_NOT_FOUND', error.message)
        }

        throw error
      }

      await writeOperationLog({
        action: input.accepted ? 'create_feedback' : 'record_override',
        detail: `Recorded ${input.userAction} feedback for AI audit ${input.auditLogId}.`,
        fallbackActorKind: 'anonymous',
        module: 'ai_feedback',
        operatorId: context.actorRbacUserId,
        requestInfo: {
          accepted: input.accepted,
          auditLogId: input.auditLogId,
          requestId: context.requestId,
          userAction: input.userAction,
        },
        targetId: input.auditLogId,
      })

      return serializeAiFeedbackEntry(feedbackRecord)
    },
  )
}

export const aiFeedbackListProcedure = requireAnyPermission(aiFeedbackPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/feedback',
    tags: ['AI:Feedback'],
    summary: '分页查询 AI 反馈记录',
    description: '返回 AI 反馈、人工接管记录和动作统计汇总，供监控与治理面板使用。',
  })
  .input(listAiFeedbackInputSchema)
  .output(aiFeedbackListResponseSchema)
  .handler(async ({ input }) => listFeedback(input))

export const aiFeedbackGetByIdProcedure = requireAnyPermission(aiFeedbackPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/feedback/:id',
    tags: ['AI:Feedback'],
    summary: '读取单条 AI 反馈详情',
    description: '返回单条 AI 反馈记录，并补充其所关联 AI 审计日志的最小上下文。',
  })
  .input(getAiFeedbackByIdInputSchema)
  .output(aiFeedbackDetailSchema)
  .handler(async ({ input }) => getFeedbackById(input))

export const aiFeedbackCreateProcedure = requireAnyPermission(aiFeedbackPermissions)
  .route({
    method: 'POST',
    path: '/api/v1/ai/feedback',
    tags: ['AI:Feedback'],
    summary: '提交 AI 反馈记录',
    description: '向指定 AI 审计日志写入反馈或人工接管结果，并同步记录操作审计日志。',
  })
  .input(createAiFeedbackInputSchema)
  .output(aiFeedbackEntrySchema)
  .handler(async ({ context, input }) =>
    createFeedback(input, {
      actorAuthUserId: context.userId,
      idempotencyKey: context.idempotencyKey,
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
