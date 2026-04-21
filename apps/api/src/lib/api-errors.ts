import {
  type apiErrorResponseSchema,
  ErrorCodes,
  type rateLimitErrorResponseSchema,
  type validationErrorResponseSchema,
} from '@ai-native-os/shared'
import type { Context } from 'hono'
import type { z } from 'zod'

type ApiErrorCodeKey = keyof typeof ErrorCodes
type ApiHttpStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500

/**
 * 生成统一 API 错误载荷，确保 REST 兼容入口、限流与中间件返回相同结构。
 */
export function createApiErrorPayload(
  code: ApiErrorCodeKey,
  status: ApiHttpStatus,
  message?: string,
  requestId?: string,
): z.infer<typeof apiErrorResponseSchema> {
  return {
    code,
    errorCode: ErrorCodes[code].code,
    message: message ?? ErrorCodes[code].message,
    requestId,
    status,
  }
}

/**
 * 生成统一参数校验错误载荷，保留字段级 issue 信息便于前端直接消费。
 */
export function createValidationErrorPayload(
  error: z.ZodError,
  requestId?: string,
  message = 'Invalid request payload',
): z.infer<typeof validationErrorResponseSchema> {
  return {
    code: 'BAD_REQUEST',
    errorCode: ErrorCodes.BAD_REQUEST.code,
    message,
    requestId,
    status: 400,
    issues: error.flatten(),
  }
}

/**
 * 生成统一限流错误载荷，保留 retry-after 秒数和业务错误码。
 */
export function createRateLimitErrorPayload(
  retryAfterSeconds: number,
  requestId?: string,
): z.infer<typeof rateLimitErrorResponseSchema> {
  return {
    code: 'RATE_LIMITED',
    errorCode: ErrorCodes.RATE_LIMITED.code,
    message: ErrorCodes.RATE_LIMITED.message,
    requestId,
    status: 429,
    retryAfterSeconds,
  }
}

/**
 * 在 Hono 上输出统一错误 JSON。
 */
export function jsonApiError<TContext extends Context>(
  context: TContext,
  code: ApiErrorCodeKey,
  status: ApiHttpStatus,
  message?: string,
): Response {
  return context.json(
    createApiErrorPayload(code, status, message, context.get('requestId') as string | undefined),
    status,
  )
}

/**
 * 将任意 HTTP 状态映射为仓库内允许的 API 错误状态集合。
 */
export function normalizeApiHttpStatus(status: number | undefined): ApiHttpStatus {
  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 429 ||
    status === 500
  ) {
    return status
  }

  return 400
}
