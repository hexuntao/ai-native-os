import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { listAiEvalRunsByEvalKey } from '@ai-native-os/db'

import { buildMastraEvalCatalogSnapshot, runMastraEvalSuite } from './runner'

test('mastra eval runner executes report-schedule suite and persists experiment results', async () => {
  const runResult = await runMastraEvalSuite({
    actorAuthUserId: 'system:api-test',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `api-eval-${randomUUID()}`,
    triggerSource: 'test',
  })
  const persistedRuns = await listAiEvalRunsByEvalKey('report-schedule')

  assert.equal(runResult.evalId, 'report-schedule')
  assert.equal(runResult.status, 'completed')
  assert.ok(runResult.totalItems >= 1)
  assert.ok(
    persistedRuns.some(
      (run) =>
        run.experimentId === runResult.experimentId &&
        run.status === 'completed' &&
        run.scorerSummary.report_schedule_structure?.sampleCount !== undefined,
    ),
  )
})

test('mastra eval catalog snapshot reflects dataset registration and latest run metadata', async () => {
  await runMastraEvalSuite({
    actorAuthUserId: 'system:api-catalog',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `api-eval-catalog-${randomUUID()}`,
    triggerSource: 'test',
  })

  const snapshot = await buildMastraEvalCatalogSnapshot()
  const reportScheduleEntry = snapshot.entries.find((entry) => entry.id === 'report-schedule')

  assert.equal(snapshot.configured, true)
  assert.ok(snapshot.totalDatasets >= 1)
  assert.ok(snapshot.totalExperiments >= 1)
  assert.ok(reportScheduleEntry)
  assert.equal(reportScheduleEntry?.status, 'registered')
  assert.ok((reportScheduleEntry?.datasetSize ?? 0) >= 1)
  assert.equal(reportScheduleEntry?.lastRunStatus, 'completed')
  assert.ok(reportScheduleEntry?.lastRunAverageScore !== null)
})
