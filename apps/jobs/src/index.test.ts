import assert from 'node:assert/strict'
import test from 'node:test'

import { listAiAuditLogsByToolId } from '@ai-native-os/db'

import { executeReportScheduleTask, reportScheduleTask } from './trigger/report-schedule'

test('scheduled report task executes the workflow and writes task-level audit logs', async () => {
  const result = await executeReportScheduleTask({
    reportLabel: 'jobs-smoke-report',
    triggerSource: 'test',
  })
  const taskLogs = await listAiAuditLogsByToolId('task:report-schedule-trigger')

  assert.equal(result.taskId, 'report-schedule-trigger')
  assert.equal(result.workflow.reportLabel, 'jobs-smoke-report')
  assert.equal(result.workflow.triggerSource, 'test')
  assert.ok(
    taskLogs.some(
      (log: (typeof taskLogs)[number]) =>
        log.requestInfo?.requestId === result.workflow.requestId && log.status === 'success',
    ),
  )
  assert.equal(reportScheduleTask.id, 'report-schedule-trigger')
})
