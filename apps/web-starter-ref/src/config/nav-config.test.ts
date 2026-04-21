import assert from 'node:assert/strict'
import test from 'node:test'

import { navGroups } from './nav-config'

test('starter ref nav keeps ai-native lifecycle groups', () => {
  assert.deepEqual(
    navGroups.map((group) => group.label),
    ['Home', 'Build', 'Observe', 'Improve', 'Knowledge', 'Govern', 'Workspace', 'Admin'],
  )
})
