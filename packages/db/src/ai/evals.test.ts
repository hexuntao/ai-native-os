import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { countAiEvalRuns, listAiEvalRunsByEvalKey, persistAiEvalRun } from './evals'

test('persistAiEvalRun stores run and item records with scorer summary', async () => {
  const experimentId = `db-eval-${randomUUID()}`
  const persistedRun = await persistAiEvalRun({
    actorAuthUserId: 'system:db-test',
    actorRbacUserId: null,
    completedAt: new Date(),
    datasetId: `dataset-${randomUUID()}`,
    datasetName: 'db-eval-dataset',
    evalKey: 'db-eval-suite',
    evalName: 'DB Eval Suite',
    experimentId,
    failedCount: 0,
    items: [
      {
        datasetItemId: `item-${randomUUID()}`,
        errorMessage: null,
        groundTruth: {
          expected: 'ok',
        },
        input: {
          prompt: 'smoke',
        },
        itemIndex: 0,
        output: {
          response: 'ok',
        },
        scores: {
          db_eval_score: {
            error: null,
            reason: 'matches',
            score: 1,
          },
        },
      },
    ],
    requestId: `request-${randomUUID()}`,
    scoreAverage: 1,
    scoreMax: 1,
    scoreMin: 1,
    scorerSummary: {
      db_eval_score: {
        averageScore: 1,
        maxScore: 1,
        minScore: 1,
        sampleCount: 1,
      },
    },
    skippedCount: 0,
    startedAt: new Date(),
    status: 'completed',
    succeededCount: 1,
    totalItems: 1,
    triggerSource: 'test',
  })
  const runsByEvalKey = await listAiEvalRunsByEvalKey('db-eval-suite')

  assert.equal(persistedRun.experimentId, experimentId)
  assert.equal(persistedRun.status, 'completed')
  assert.equal(persistedRun.scoreAverage, 1)
  assert.ok(
    runsByEvalKey.some(
      (run) =>
        run.experimentId === experimentId &&
        run.scorerSummary.db_eval_score?.sampleCount === 1 &&
        run.totalItems === 1,
    ),
  )
})

test('countAiEvalRuns returns non-negative totals', async () => {
  const totalRuns = await countAiEvalRuns()

  assert.ok(totalRuns >= 0)
})
