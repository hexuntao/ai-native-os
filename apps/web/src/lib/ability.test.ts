import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canManagePermissions,
  canManageRoles,
  canManageUserDirectory,
  getVisibleNavigationItems,
  parseSerializedAbilityPayload,
} from './ability'

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
  assert.equal(canManageUserDirectory(payload), false)
  assert.equal(canManageRoles(payload), false)
  assert.equal(canManagePermissions(payload), false)
})

test('manage user permission exposes user directory write capability', () => {
  const payload = parseSerializedAbilityPayload({
    roleCodes: ['admin'],
    rules: [
      { action: 'manage', subject: 'User' },
      { action: 'read', subject: 'Role' },
    ],
    userId: 'bb95c2ce-9db2-4ae8-80b4-123456789abc',
  })

  assert.equal(canManageUserDirectory(payload), true)
  assert.equal(canManageRoles(payload), false)
  assert.equal(canManagePermissions(payload), false)
})

test('manage role permission exposes role directory write capability', () => {
  const payload = parseSerializedAbilityPayload({
    roleCodes: ['admin'],
    rules: [
      { action: 'manage', subject: 'Role' },
      { action: 'read', subject: 'User' },
    ],
    userId: 'cb95c2ce-9db2-4ae8-80b4-123456789abc',
  })

  assert.equal(canManageRoles(payload), true)
  assert.equal(canManagePermissions(payload), false)
})

test('manage permission permission exposes permission center write capability', () => {
  const payload = parseSerializedAbilityPayload({
    roleCodes: ['admin'],
    rules: [
      { action: 'manage', subject: 'Permission' },
      { action: 'read', subject: 'Role' },
    ],
    userId: 'db95c2ce-9db2-4ae8-80b4-123456789abc',
  })

  assert.equal(canManagePermissions(payload), true)
})
