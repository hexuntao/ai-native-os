import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCatalogListResponse,
  matchesCatalogSearch,
  normalizeCatalogSearchTerm,
  resolveApiRouteContractFamily,
} from './catalog-query'

test('normalizeCatalogSearchTerm trims and lowercases non-empty input', () => {
  assert.equal(normalizeCatalogSearchTerm('  Prompt Governance  '), 'prompt governance')
  assert.equal(normalizeCatalogSearchTerm('   '), null)
  assert.equal(normalizeCatalogSearchTerm(undefined), null)
})

test('matchesCatalogSearch returns true only when at least one field matches the normalized search term', () => {
  assert.equal(matchesCatalogSearch(['Prompt Governance', 'Audit'], 'prompt'), true)
  assert.equal(matchesCatalogSearch(['Prompt Governance', 'Audit'], 'worker'), false)
  assert.equal(matchesCatalogSearch(['Prompt Governance', 'Audit'], null), true)
})

test('createCatalogListResponse uses shared page and pageSize input to build a stable paginated response', () => {
  const response = createCatalogListResponse(['a', 'b', 'c'], {
    page: 2,
    pageSize: 1,
  })

  assert.deepEqual(response.data, ['b'])
  assert.equal(response.pagination.page, 2)
  assert.equal(response.pagination.pageSize, 1)
  assert.equal(response.pagination.total, 3)
})

test('resolveApiRouteContractFamily classifies the public route namespaces and rejects unknown paths', () => {
  assert.equal(resolveApiRouteContractFamily('/api/v1/ai/prompts'), 'ai')
  assert.equal(resolveApiRouteContractFamily('/api/v1/monitor/server'), 'monitor')
  assert.equal(resolveApiRouteContractFamily('/api/v1/system/users'), 'system')
  assert.equal(resolveApiRouteContractFamily('/api/v1/tools/jobs'), 'tools')
  assert.equal(resolveApiRouteContractFamily('/api/auth/sign-in/email'), null)
})
