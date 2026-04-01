import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  listOperationLogsByModule,
  systemOperationActorId,
  writeOperationLog,
} from './operation-logs'

test('writeOperationLog persists sanitized request info with system fallback actor', async () => {
  const moduleCode = `db-operation-log-${randomUUID()}`
  const requestId = `request-${randomUUID()}`
  const record = await writeOperationLog({
    action: 'sync_snapshot',
    detail: 'Persisted a synthetic observability record for package-level verification.',
    fallbackActorKind: 'system',
    module: moduleCode,
    requestInfo: {
      attempt: 1,
      requestId,
      success: true,
    },
  })
  const rows = await listOperationLogsByModule(moduleCode)

  assert.equal(record.operatorId, systemOperationActorId)
  assert.equal(record.requestInfo?.requestId, requestId)
  assert.equal(record.requestInfo?.attempt, '1')
  assert.equal(record.requestInfo?.success, 'true')
  assert.ok(rows.some((row) => row.id === record.id))
})
