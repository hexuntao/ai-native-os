import assert from 'node:assert/strict'
import test from 'node:test'

import {
  type ReleasePreflightDependencies,
  resolveReleasePreflightEnvironment,
  runReleasePreflight,
} from './preflight'

test('resolveReleasePreflightEnvironment accepts optional backup verification by default', () => {
  const environment = resolveReleasePreflightEnvironment({})

  assert.equal(environment.backupFileConfigured, false)
  assert.equal(environment.requireBackupVerification, false)
})

test('resolveReleasePreflightEnvironment requires BACKUP_FILE when backup verification is mandatory', () => {
  assert.throws(
    () =>
      resolveReleasePreflightEnvironment({
        RELEASE_REQUIRE_BACKUP_VERIFY: 'true',
      }),
    /BACKUP_FILE is required/,
  )
})

test('runReleasePreflight skips backup verification when no artifact is configured', async () => {
  const dependencies: ReleasePreflightDependencies = {
    now: () => new Date('2026-04-20T08:00:00.000Z'),
    runBackupVerification: async () => {
      throw new Error('backup verification should not run')
    },
    runReleaseSmoke: async () => ({
      checkedAt: '2026-04-20T08:00:00.000Z',
      results: [],
      status: 'ok',
      warnings: [],
    }),
  }

  const summary = await runReleasePreflight(
    {
      backupFileConfigured: false,
      requireBackupVerification: false,
    },
    dependencies,
  )

  assert.equal(summary.status, 'ok')
  assert.equal(summary.backupVerification.status, 'skipped')
  assert.match(summary.warnings[0] ?? '', /backup verification skipped/)
})

test('runReleasePreflight executes backup verification when required', async () => {
  const summary = await runReleasePreflight(
    {
      backupFileConfigured: true,
      requireBackupVerification: true,
    },
    {
      now: () => new Date('2026-04-20T08:00:00.000Z'),
      runBackupVerification: async () => ({
        ageHours: 1,
        backupFile: '/tmp/test.dump',
        checksumVerified: false,
        detectedFormat: 'postgres-custom',
        modifiedAt: '2026-04-20T07:00:00.000Z',
        sizeBytes: 4096,
        status: 'ok',
      }),
      runReleaseSmoke: async () => ({
        checkedAt: '2026-04-20T08:00:00.000Z',
        results: [],
        status: 'ok',
        warnings: ['smoke-warning'],
      }),
    },
  )

  assert.equal(summary.backupVerification.status, 'passed')
  assert.equal(summary.releaseSmoke.status, 'ok')
  assert.deepEqual(summary.warnings, ['smoke-warning'])
})
