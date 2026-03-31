import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultLocalDatabaseUrl, resolveDatabaseUrl } from './index'

test('resolveDatabaseUrl uses explicit value when provided', () => {
  const databaseUrl = 'postgresql://postgres:postgres@localhost:5999/custom'

  assert.equal(resolveDatabaseUrl(databaseUrl), databaseUrl)
})

test('resolveDatabaseUrl falls back to local development database', () => {
  assert.equal(resolveDatabaseUrl(undefined), defaultLocalDatabaseUrl)
})
