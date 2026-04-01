import assert from 'node:assert/strict'
import test from 'node:test'

import { listAiAuditLogsByToolId } from '@ai-native-os/db'

import {
  createReportScheduleTaskRequestContext,
  reportSchedule,
  runReportScheduleWorkflow,
} from './report-schedule'

test('report schedule workflow produces a read-only snapshot with audit correlation', async () => {
  const requestContext = createReportScheduleTaskRequestContext()
  const result = await runReportScheduleWorkflow({
    input: {
      reportLabel: 'workflow-smoke-report',
      scheduledAt: null,
      triggerSource: 'test',
    },
    requestContext,
  })
  const workflowLogs = await listAiAuditLogsByToolId('workflow:report-schedule')
  const toolLogs = await listAiAuditLogsByToolId('report-data-snapshot')

  assert.equal(result.reportLabel, 'workflow-smoke-report')
  assert.equal(result.triggerSource, 'test')
  assert.ok(result.requestId.startsWith('trigger-report-schedule-'))
  assert.ok(result.snapshot.generatedAt.length > 0)
  assert.ok(result.snapshot.counts.users >= 0)
  assert.ok(
    workflowLogs.some(
      (log) => log.requestInfo?.requestId === result.requestId && log.status === 'success',
    ),
  )
  assert.ok(
    toolLogs.some(
      (log) => log.requestInfo?.requestId === result.requestId && log.status === 'success',
    ),
  )
})

test('report schedule workflow is registered in the runtime registry', async () => {
  const run = await reportSchedule.createRun()
  const result = await run.start({
    inputData: {
      reportLabel: 'registry-smoke-report',
      scheduledAt: null,
      triggerSource: 'test',
    },
    requestContext: createReportScheduleTaskRequestContext(),
  })

  assert.equal(result.status, 'success')
  if (result.status === 'success') {
    assert.equal(result.result.reportLabel, 'registry-smoke-report')
  }
})
