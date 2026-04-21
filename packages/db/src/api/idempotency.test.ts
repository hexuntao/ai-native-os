import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from './idempotency'

/**
 * 为单次测试生成独占的幂等请求键，避免并行测试之间互相污染。
 */
function createIdempotencySeed(): {
  actorAuthUserId: string
  idempotencyKey: string
  scope: string
} {
  const suffix = randomUUID()

  return {
    actorAuthUserId: `idempotency-auth-${suffix}`,
    idempotencyKey: `idem-${suffix}`,
    scope: `test.scope.${suffix}`,
  }
}

test('beginIdempotentRequest replays a completed success payload for the same actor, scope, and key', async () => {
  const seed = createIdempotencySeed()
  const firstAttempt = await beginIdempotentRequest({
    actorAuthUserId: seed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: seed.idempotencyKey,
    requestFingerprint: 'fingerprint-success',
    scope: seed.scope,
  })

  assert.equal(firstAttempt.kind, 'execute')
  await completeIdempotentRequest(firstAttempt.recordId, {
    ok: true,
    replayed: false,
  })

  const replayAttempt = await beginIdempotentRequest({
    actorAuthUserId: seed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: seed.idempotencyKey,
    requestFingerprint: 'fingerprint-success',
    scope: seed.scope,
  })

  assert.equal(replayAttempt.kind, 'replay_success')
  assert.deepEqual(replayAttempt.payload, {
    ok: true,
    replayed: false,
  })
})

test('beginIdempotentRequest rejects payload drift and replays stored failure metadata', async () => {
  const mismatchSeed = createIdempotencySeed()
  const firstAttempt = await beginIdempotentRequest({
    actorAuthUserId: mismatchSeed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: mismatchSeed.idempotencyKey,
    requestFingerprint: 'fingerprint-a',
    scope: mismatchSeed.scope,
  })

  assert.equal(firstAttempt.kind, 'execute')

  const mismatchAttempt = await beginIdempotentRequest({
    actorAuthUserId: mismatchSeed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: mismatchSeed.idempotencyKey,
    requestFingerprint: 'fingerprint-b',
    scope: mismatchSeed.scope,
  })

  assert.equal(mismatchAttempt.kind, 'replay_error')
  assert.equal(mismatchAttempt.errorCode, 'IDEMPOTENCY_PAYLOAD_MISMATCH')

  const failureSeed = createIdempotencySeed()
  const failedAttempt = await beginIdempotentRequest({
    actorAuthUserId: failureSeed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: failureSeed.idempotencyKey,
    requestFingerprint: 'fingerprint-failed',
    scope: failureSeed.scope,
  })

  assert.equal(failedAttempt.kind, 'execute')
  await failIdempotentRequest(failedAttempt.recordId, {
    errorCode: 'AI_PROMPT_RELEASE_GATE_FAILED',
    errorMessage: 'release gate rejected the prompt',
    errorStatus: 409,
  })

  const replayFailureAttempt = await beginIdempotentRequest({
    actorAuthUserId: failureSeed.actorAuthUserId,
    actorRbacUserId: null,
    idempotencyKey: failureSeed.idempotencyKey,
    requestFingerprint: 'fingerprint-failed',
    scope: failureSeed.scope,
  })

  assert.equal(replayFailureAttempt.kind, 'replay_error')
  assert.equal(replayFailureAttempt.errorCode, 'AI_PROMPT_RELEASE_GATE_FAILED')
  assert.equal(replayFailureAttempt.errorStatus, 409)
})
