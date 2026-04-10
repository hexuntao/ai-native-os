import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FinalRegressionError,
  finalizeRegressionSummary,
  type RegressionStepResult,
  resolveFinalRegressionEnvironment,
} from './e2e-regression'

/**
 * 构造最小回归步骤，供纯函数测试复用。
 */
function createRegressionStep(
  name: string,
  status: RegressionStepResult['status'],
): RegressionStepResult {
  return {
    detail: name,
    durationMs: 1,
    name,
    status,
    warnings: [],
  }
}

test('resolveFinalRegressionEnvironment defaults to existing release smoke mode', () => {
  const environment = resolveFinalRegressionEnvironment({})

  assert.equal(environment.releaseSmokeMode, 'existing')
})

test('resolveFinalRegressionEnvironment accepts skip mode', () => {
  const environment = resolveFinalRegressionEnvironment({
    E2E_RELEASE_SMOKE_MODE: 'skip',
  })

  assert.equal(environment.releaseSmokeMode, 'skip')
})

test('finalizeRegressionSummary returns high trust when all steps pass', () => {
  const summary = finalizeRegressionSummary(
    [createRegressionStep('lint', 'passed'), createRegressionStep('release-smoke', 'passed')],
    {
      now: () => new Date('2026-04-10T10:00:00.000Z'),
    },
  )

  assert.equal(summary.status, 'passed')
  assert.equal(summary.releaseTrust, 'high')
})

test('finalizeRegressionSummary lowers trust when release smoke is skipped', () => {
  const summary = finalizeRegressionSummary(
    [createRegressionStep('lint', 'passed'), createRegressionStep('release-smoke', 'skipped')],
    {
      now: () => new Date('2026-04-10T10:00:00.000Z'),
    },
  )

  assert.equal(summary.status, 'passed')
  assert.equal(summary.releaseTrust, 'medium')
})

test('finalizeRegressionSummary throws a structured error when any step fails', () => {
  assert.throws(
    () =>
      finalizeRegressionSummary(
        [createRegressionStep('lint', 'passed'), createRegressionStep('build', 'failed')],
        {
          now: () => new Date('2026-04-10T10:00:00.000Z'),
        },
      ),
    (error: unknown) =>
      error instanceof FinalRegressionError &&
      error.summary.status === 'failed' &&
      error.summary.steps[1]?.name === 'build',
  )
})
