import { ErrorCodes } from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'

type ApiErrorCodeKey = keyof typeof ErrorCodes

/**
 * 构造稳定的业务错误，统一让 oRPC 与 REST 兼容入口都能消费相同错误键。
 */
function createDomainOrpcError(
  code: ApiErrorCodeKey,
  status: number,
  message?: string,
): ORPCError<ApiErrorCodeKey, undefined> {
  return new ORPCError(code, {
    message: message ?? ErrorCodes[code].message,
    status,
  })
}

/**
 * 构造业务层 400 错误，适用于参数合法但前置条件不满足的场景。
 */
export function domainBadRequestError(
  code: ApiErrorCodeKey,
  message?: string,
): ORPCError<ApiErrorCodeKey, undefined> {
  return createDomainOrpcError(code, 400, message)
}

/**
 * 构造业务层 404 错误，避免继续混用通用 NOT_FOUND 与自然语言 message。
 */
export function domainNotFoundError(
  code: ApiErrorCodeKey,
  message?: string,
): ORPCError<ApiErrorCodeKey, undefined> {
  return createDomainOrpcError(code, 404, message)
}

/**
 * 构造业务层 409 错误，供幂等冲突、治理门禁和唯一性冲突等复用。
 */
export function domainConflictError(
  code: ApiErrorCodeKey,
  message?: string,
): ORPCError<ApiErrorCodeKey, undefined> {
  return createDomainOrpcError(code, 409, message)
}
