import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPermissionKey,
  defaultPermissions,
  defaultRolePermissionKeysByCode,
  defaultRoles,
  defaultUsers,
} from './rbac'

test('default RBAC seed covers the four baseline roles', () => {
  assert.deepEqual(
    defaultRoles.map((role) => role.code),
    ['super_admin', 'admin', 'editor', 'viewer'],
  )
  assert.equal(defaultUsers.length, 4)
})

test('default permissions contain manage:all for super admin', () => {
  const permissionKeys = defaultPermissions.map((permission) =>
    createPermissionKey(permission.action, permission.subject),
  )

  assert.ok(permissionKeys.includes('manage:all'))
  assert.deepEqual(defaultRolePermissionKeysByCode.super_admin, ['manage:all'])
})
