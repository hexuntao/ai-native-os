import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { persistAiEvalRun } from './evals'
import {
  activatePromptVersion,
  attachPromptEvalEvidence,
  createPromptVersion,
  listPromptVersions,
  PromptReleaseGateError,
  rollbackPromptVersion,
} from './prompt-versions'

interface PersistCompletedEvalRunInput {
  averageScore: number
  evalKey: string
}

/**
 * 生成一条可用于 Prompt 发布门禁验证的已完成评估记录。
 */
async function persistCompletedEvalRun(
  input: PersistCompletedEvalRunInput,
): Promise<{ id: string }> {
  return persistAiEvalRun({
    actorAuthUserId: 'system:prompt-version-test',
    actorRbacUserId: null,
    completedAt: new Date(),
    datasetId: `dataset-${randomUUID()}`,
    datasetName: `dataset-${input.evalKey}`,
    evalKey: input.evalKey,
    evalName: `Eval ${input.evalKey}`,
    experimentId: `experiment-${randomUUID()}`,
    failedCount: 0,
    items: [
      {
        datasetItemId: `dataset-item-${randomUUID()}`,
        errorMessage: null,
        groundTruth: {
          expected: 'ok',
        },
        input: {
          query: 'prompt governance',
        },
        itemIndex: 0,
        output: {
          result: 'ok',
        },
        scores: {
          safety: {
            error: null,
            reason: 'stable',
            score: input.averageScore,
          },
        },
      },
    ],
    requestId: `request-${randomUUID()}`,
    scoreAverage: input.averageScore,
    scoreMax: input.averageScore,
    scoreMin: input.averageScore,
    scorerSummary: {
      safety: {
        averageScore: input.averageScore,
        maxScore: input.averageScore,
        minScore: input.averageScore,
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
}

test('activatePromptVersion rejects prompt without eval evidence', async () => {
  const createdPromptVersion = await createPromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    promptKey: `governance-${randomUUID().slice(0, 8)}`,
    promptText: 'v1 prompt',
    releasePolicy: {
      minAverageScore: 0.8,
      scorerThresholds: {},
    },
  })

  assert.equal(createdPromptVersion.releaseReady, false)
  await assert.rejects(
    async () =>
      activatePromptVersion({
        actorAuthUserId: 'test-user',
        actorRbacUserId: null,
        promptVersionId: createdPromptVersion.id,
      }),
    (error: unknown) =>
      error instanceof PromptReleaseGateError && /missing eval evidence/.test(error.message),
  )
})

test('prompt version supports evidence attach, activation, and rollback flow', async () => {
  const promptKey = `release-${randomUUID().slice(0, 8)}`
  const v1 = await createPromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    notes: 'v1',
    promptKey,
    promptText: 'v1 prompt',
    releasePolicy: {
      minAverageScore: 0.6,
      scorerThresholds: {
        safety: 0.6,
      },
    },
  })
  const v1EvalRun = await persistCompletedEvalRun({
    averageScore: 0.95,
    evalKey: `eval-${randomUUID().slice(0, 8)}`,
  })

  const v1WithEvidence = await attachPromptEvalEvidence({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    evalRunId: v1EvalRun.id,
    promptVersionId: v1.id,
  })
  const v1Active = await activatePromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    promptVersionId: v1.id,
  })

  assert.equal(v1WithEvidence.releaseReady, true)
  assert.equal(v1Active.isActive, true)

  const v2 = await createPromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    notes: 'v2',
    promptKey,
    promptText: 'v2 prompt',
    releasePolicy: {
      minAverageScore: 0.6,
      scorerThresholds: {
        safety: 0.6,
      },
    },
  })
  const v2EvalRun = await persistCompletedEvalRun({
    averageScore: 0.9,
    evalKey: `eval-${randomUUID().slice(0, 8)}`,
  })

  await attachPromptEvalEvidence({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    evalRunId: v2EvalRun.id,
    promptVersionId: v2.id,
  })
  const v2Active = await activatePromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    promptVersionId: v2.id,
  })

  assert.equal(v2Active.isActive, true)
  assert.equal(v2Active.status, 'active')

  const rolledBackVersion = await rollbackPromptVersion({
    actorAuthUserId: 'test-user',
    actorRbacUserId: null,
    promptKey,
  })
  const listedVersions = await listPromptVersions({
    page: 1,
    pageSize: 20,
    promptKey,
  })

  assert.equal(rolledBackVersion.id, v1.id)
  assert.equal(rolledBackVersion.isActive, true)
  assert.equal(rolledBackVersion.rolledBackFromVersionId, v2.id)
  assert.equal(listedVersions.summary.activeCount, 1)
  assert.equal(listedVersions.summary.releaseReadyCount, 2)
})
