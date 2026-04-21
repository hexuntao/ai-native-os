import { createHash } from 'node:crypto'
import {
  type BeginIdempotentRequestResult,
  beginIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from '@ai-native-os/db'
import { ORPCError } from '@orpc/server'

import type { AppContext } from '@/orpc/context'

import { domainConflictError } from './domain-errors'

interface IdempotentMutationContext {
  actorAuthUserId: string
  actorRbacUserId: string | null
  idempotencyKey: string | null
}

/**
 * 以稳定键顺序序列化任意 JSON 值，避免对象键顺序差异导致幂等指纹漂移。
 */
function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    )

    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

/**
 * 计算请求指纹，确保相同幂等键只能绑定相同语义的请求。
 */
function buildRequestFingerprint(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex')
}

/**
 * 将已完成的幂等结果重放为当前调用的返回值或稳定业务错误。
 */
function resolveIdempotentReplayResult<TResponse>(
  replayResult: BeginIdempotentRequestResult,
): TResponse | null {
  if (replayResult.kind === 'replay_success') {
    return replayResult.payload as TResponse
  }

  if (replayResult.kind === 'replay_error') {
    if (replayResult.errorCode === 'IDEMPOTENCY_REQUEST_IN_PROGRESS') {
      throw domainConflictError('IDEMPOTENCY_REQUEST_IN_PROGRESS', replayResult.errorMessage)
    }

    if (replayResult.errorCode === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw domainConflictError('IDEMPOTENCY_PAYLOAD_MISMATCH', replayResult.errorMessage)
    }

    throw new ORPCError(replayResult.errorCode, {
      message: replayResult.errorMessage,
      status: replayResult.errorStatus,
    })
  }

  return null
}

/**
 * 为命令型接口提供统一幂等执行包装；未提供幂等键时按普通写路径执行。
 */
export async function runIdempotentMutation<TResponse>(
  scope: string,
  input: unknown,
  context: IdempotentMutationContext,
  execute: () => Promise<TResponse>,
): Promise<TResponse> {
  if (!context.idempotencyKey) {
    return execute()
  }

  const replayResult = await beginIdempotentRequest({
    actorAuthUserId: context.actorAuthUserId,
    actorRbacUserId: context.actorRbacUserId,
    idempotencyKey: context.idempotencyKey,
    requestFingerprint: buildRequestFingerprint(input),
    scope,
  })

  const replayPayload = resolveIdempotentReplayResult<TResponse>(replayResult)

  if (replayPayload !== null) {
    return replayPayload
  }

  if (replayResult.kind !== 'execute') {
    throw new Error(`Unexpected idempotency replay state for ${scope}`)
  }

  const recordId = replayResult.recordId

  try {
    const responsePayload = await execute()

    await completeIdempotentRequest(recordId, responsePayload)

    return responsePayload
  } catch (error) {
    if (error instanceof ORPCError) {
      await failIdempotentRequest(recordId, {
        errorCode: error.code,
        errorMessage: error.message,
        errorStatus: error.status,
      })
    } else {
      await failIdempotentRequest(recordId, {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown idempotent mutation error',
        errorStatus: 500,
      })
    }

    throw error
  }
}

/**
 * 从 AppContext 中提取幂等执行所需最小主体信息，避免各路由重复拼装。
 */
export function createIdempotentMutationContext(context: AppContext): IdempotentMutationContext {
  return {
    actorAuthUserId: context.userId ?? '',
    actorRbacUserId: context.rbacUserId,
    idempotencyKey: context.idempotencyKey,
  }
}
