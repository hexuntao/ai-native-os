import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'

import { db, pool } from '../client'
import { loadUserPermissionProfileByEmail } from '../rbac/load-permissions'
import { permissions, rolePermissions, roles } from '../schema'
import {
  createPermissionKey,
  defaultRolePermissionKeysByCode,
  defaultRoles,
  defaultUsers,
  seedRbacDefaults,
} from './rbac'

function createStoredPermissionKey(action: string, resource: string): string {
  return `${action}:${resource}`
}

async function main(): Promise<void> {
  await seedRbacDefaults(db)

  for (const role of defaultRoles) {
    const [storedRole] = await db
      .select({
        code: roles.code,
        id: roles.id,
      })
      .from(roles)
      .where(eq(roles.id, role.id))
      .limit(1)

    assert.ok(storedRole, `Expected role ${role.code} to exist`)

    const permissionRows = await db
      .select({
        action: permissions.action,
        resource: permissions.resource,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, role.id))

    const actualPermissionKeys = permissionRows
      .map((permission) => createStoredPermissionKey(permission.action, permission.resource))
      .sort()
    const expectedPermissionKeys = [...(defaultRolePermissionKeysByCode[role.code] ?? [])].sort()

    assert.deepEqual(actualPermissionKeys, expectedPermissionKeys)
  }

  for (const seededUser of defaultUsers) {
    const profile = await loadUserPermissionProfileByEmail(seededUser.email, db)

    assert.ok(profile, `Expected permission profile for ${seededUser.email}`)
    assert.deepEqual(profile?.roleCodes, [...seededUser.roleCodes].sort())

    const expectedPermissionKeys = seededUser.roleCodes.flatMap(
      (roleCode) => defaultRolePermissionKeysByCode[roleCode] ?? [],
    )
    const actualPermissionKeys =
      profile?.rules.map((rule) => createPermissionKey(rule.action, rule.subject)).sort() ?? []

    assert.deepEqual(actualPermissionKeys, [...expectedPermissionKeys].sort())
  }
}

main()
  .then(async () => {
    console.info('RBAC seed verification passed.')
    await pool.end()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await pool.end()
    process.exitCode = 1
  })
