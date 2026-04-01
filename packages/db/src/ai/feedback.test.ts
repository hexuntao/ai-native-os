import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { listRecentAiAuditLogs, writeAiAuditLog } from './audit-logs'
import { createAiFeedback, listAiFeedbackByAuditLogId } from './feedback'

test('createAiFeedback persists feedback and marks human override on the audit log', async () => {
  const actorAuthUserId = `feedback-${randomUUID()}`
  const auditLog = await writeAiAuditLog({
    action: 'read',
    actorAuthUserId,
    actorRbacUserId: null,
    input: {
      query: 'show me the newest users',
    },
    output: {
      result: 'ok',
    },
    requestInfo: {
      requestId: `feedback-request-${randomUUID()}`,
    },
    roleCodes: ['admin'],
    status: 'success',
    subject: 'AiAuditLog',
    toolId: 'tool:user-directory',
  })

  const feedbackRecord = await createAiFeedback({
    accepted: false,
    actorAuthUserId,
    actorRbacUserId: null,
    auditLogId: auditLog.id,
    correction: 'Use the filtered viewer role list instead.',
    feedbackText: 'The suggestion ignored the role constraint.',
    userAction: 'edited',
  })
  const feedbackRows = await listAiFeedbackByAuditLogId(auditLog.id)
  const refreshedAuditLog = (await listRecentAiAuditLogs(5)).find((row) => row.id === auditLog.id)

  assert.equal(feedbackRecord.userAction, 'edited')
  assert.equal(feedbackRows[0]?.auditLogId, auditLog.id)
  assert.equal(refreshedAuditLog?.humanOverride, true)
})
