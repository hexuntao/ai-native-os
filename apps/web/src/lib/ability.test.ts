import assert from 'node:assert/strict'
import test from 'node:test'

import { getVisibleNavigationItems, parseSerializedAbilityPayload } from './ability'

test('viewer ability payload only exposes read surfaces', () => {
  const payload = parseSerializedAbilityPayload({
    roleCodes: ['viewer'],
    rules: [
      { action: 'read', subject: 'Role' },
      { action: 'read', subject: 'OperationLog' },
    ],
    userId: '9d95c2ce-9db2-4ae8-80b4-123456789abc',
  })
  const labels = getVisibleNavigationItems(payload).map((item) => item.label)

  assert.deepEqual(labels, ['Roles Matrix', 'Audit Trails', 'System Health'])
})
