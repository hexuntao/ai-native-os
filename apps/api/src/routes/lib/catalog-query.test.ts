import assert from 'node:assert/strict'
import test from 'node:test'

import {
  matchesCatalogSearch,
  normalizeCatalogSearchTerm,
  paginateCatalog,
  sortCatalogByString,
} from './catalog-query'

test('normalizeCatalogSearchTerm trims and lowercases usable search values', () => {
  assert.equal(normalizeCatalogSearchTerm('  HeLLo  '), 'hello')
  assert.equal(normalizeCatalogSearchTerm('   '), null)
  assert.equal(normalizeCatalogSearchTerm(undefined), null)
})

test('matchesCatalogSearch returns true when any field contains the normalized search term', () => {
  assert.equal(matchesCatalogSearch(['Alpha', 'Beta'], 'bet'), true)
  assert.equal(matchesCatalogSearch(['Alpha', 'Beta'], 'gamma'), false)
  assert.equal(matchesCatalogSearch(['Alpha', 'Beta'], null), true)
})

test('sortCatalogByString and paginateCatalog keep directory responses stable', () => {
  const sorted = sortCatalogByString(
    [
      { id: '2', label: 'Zulu' },
      { id: '1', label: 'Alpha' },
      { id: '3', label: 'Mike' },
    ],
    (item) => item.label,
  )
  const paged = paginateCatalog(sorted, 1, 2)

  assert.deepEqual(
    sorted.map((item) => item.label),
    ['Alpha', 'Mike', 'Zulu'],
  )
  assert.deepEqual(
    paged.data.map((item) => item.id),
    ['1', '3'],
  )
  assert.deepEqual(paged.pagination, {
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
  })
})
