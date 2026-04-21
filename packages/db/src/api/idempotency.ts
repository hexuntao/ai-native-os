import { and, eq } from 'drizzle-orm'

import { type Database, db } from '../client'
import { type ApiIdempotencyStatus, apiIdempotencyKeys } from '../schema'

export interface BeginIdempotentRequestInput {
  actorAuthUserId: string
  actorRbacUserId: string | null
  idempotencyKey: string
  requestFingerprint: string
  scope: string
}

export interface IdempotentReplaySuccessResult {
  kind: 'replay_success'
  payload: unknown
}

export interface IdempotentReplayErrorResult {
  errorCode: string
  errorMessage: string
  errorStatus: number
  kind: 'replay_error'
}

export interface IdempotentExecuteResult {
  kind: 'execute'
  recordId: string
}

export type BeginIdempotentRequestResult =
  | IdempotentExecuteResult
  | IdempotentReplayErrorResult
  | IdempotentReplaySuccessResult

export interface ApiIdempotencyRecord {
  actorAuthUserId: string
  actorRbacUserId: string | null
  completedAt: Date | null
  createdAt: Date
  errorCode: string | null
  errorMessage: string | null
  errorStatus: number | null
  id: string
  idempotencyKey: string
  requestFingerprint: string
  responsePayload: unknown
  scope: string
  status: ApiIdempotencyStatus
  updatedAt: Date
}

function mapApiIdempotencyRecord(
  row: typeof apiIdempotencyKeys.$inferSelect,
): ApiIdempotencyRecord {
  return {
    actorAuthUserId: row.actorAuthUserId,
    actorRbacUserId: row.actorRbacUserId,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    errorStatus: row.errorStatus ? Number(row.errorStatus) : null,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    responsePayload: row.responsePayload,
    scope: row.scope,
    status: row.status,
    updatedAt: row.updatedAt,
  }
}

/**
 * 按唯一 scope + actor + key 读取幂等记录，供冲突判定与结果重放复用。
 */
export async function getApiIdempotencyRecordByUniqueKey(
  input: Pick<BeginIdempotentRequestInput, 'actorAuthUserId' | 'idempotencyKey' | 'scope'>,
  database: Database = db,
): Promise<ApiIdempotencyRecord | null> {
  const [row] = await database
    .select()
    .from(apiIdempotencyKeys)
    .where(
      and(
        eq(apiIdempotencyKeys.scope, input.scope),
        eq(apiIdempotencyKeys.actorAuthUserId, input.actorAuthUserId),
        eq(apiIdempotencyKeys.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1)

  return row ? mapApiIdempotencyRecord(row) : null
}

/**
 * 尝试占用一次幂等键；若已存在，则返回已完成结果或进行中的占位状态。
 */
export async function beginIdempotentRequest(
  input: BeginIdempotentRequestInput,
  database: Database = db,
): Promise<BeginIdempotentRequestResult> {
  const [insertedRow] = await database
    .insert(apiIdempotencyKeys)
    .values({
      actorAuthUserId: input.actorAuthUserId,
      actorRbacUserId: input.actorRbacUserId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      scope: input.scope,
      status: 'in_progress',
    })
    .onConflictDoNothing()
    .returning()

  if (insertedRow) {
    return {
      kind: 'execute',
      recordId: insertedRow.id,
    }
  }

  const existingRecord = await getApiIdempotencyRecordByUniqueKey(input, database)

  if (!existingRecord) {
    throw new Error(`Failed to read idempotency record for ${input.scope}:${input.idempotencyKey}`)
  }

  if (existingRecord.requestFingerprint !== input.requestFingerprint) {
    return {
      errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      errorMessage: 'The same Idempotency-Key cannot be reused with a different request payload.',
      errorStatus: 409,
      kind: 'replay_error',
    }
  }

  if (existingRecord.status === 'in_progress') {
    return {
      errorCode: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      errorMessage: 'A request with the same Idempotency-Key is still in progress.',
      errorStatus: 409,
      kind: 'replay_error',
    }
  }

  if (existingRecord.status === 'failed') {
    return {
      errorCode: existingRecord.errorCode ?? 'BAD_REQUEST',
      errorMessage:
        existingRecord.errorMessage ?? 'The previous request with the same Idempotency-Key failed.',
      errorStatus: existingRecord.errorStatus ?? 400,
      kind: 'replay_error',
    }
  }

  return {
    kind: 'replay_success',
    payload: existingRecord.responsePayload,
  }
}

/**
 * 将幂等占位升级为成功结果，供后续重复请求直接重放响应体。
 */
export async function completeIdempotentRequest(
  recordId: string,
  responsePayload: unknown,
  database: Database = db,
): Promise<void> {
  await database
    .update(apiIdempotencyKeys)
    .set({
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
      errorStatus: null,
      responsePayload,
      status: 'succeeded',
      updatedAt: new Date(),
    })
    .where(eq(apiIdempotencyKeys.id, recordId))
}

/**
 * 将幂等占位升级为失败结果，保证后续重复请求得到同一错误语义。
 */
export async function failIdempotentRequest(
  recordId: string,
  input: {
    errorCode: string
    errorMessage: string
    errorStatus: number
  },
  database: Database = db,
): Promise<void> {
  await database
    .update(apiIdempotencyKeys)
    .set({
      completedAt: new Date(),
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      errorStatus: String(input.errorStatus),
      responsePayload: null,
      status: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(apiIdempotencyKeys.id, recordId))
}
