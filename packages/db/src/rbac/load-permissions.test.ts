import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { and, eq } from 'drizzle-orm'
import { hashCredentialPassword } from '../auth/credential-password'
import { db } from '../client'
import { account, user as authUsers, roles, userRoles, users } from '../schema'
import {
  loadUserPermissionProfileByAuthIdentity,
  loadUserPermissionProfileByAuthUserId,
} from './load-permissions'
import { listPrincipalRepairCandidates, repairPrincipalBindings } from './principal-repair'

/**
 * 为权限装配测试创建一条最小可用的 credential auth 主体。
 */
async function createAuthIdentity(authUserId: string, email: string, name: string): Promise<void> {
  const now = new Date()

  await db.insert(authUsers).values({
    createdAt: now,
    email,
    emailVerified: true,
    id: authUserId,
    image: null,
    name,
    updatedAt: now,
  })

  await db.insert(account).values({
    accessToken: null,
    accessTokenExpiresAt: null,
    accountId: authUserId,
    createdAt: now,
    id: randomUUID(),
    idToken: null,
    password: await hashCredentialPassword('Passw0rd!Passw0rd!'),
    providerId: 'credential',
    refreshToken: null,
    refreshTokenExpiresAt: null,
    scope: null,
    updatedAt: now,
    userId: authUserId,
  })
}

test('loadUserPermissionProfileByAuthUserId resolves users through stable auth binding', async () => {
  const suffix = randomUUID().slice(0, 8)
  const authUserId = `bound-auth-${suffix}`
  const email = `bound-${suffix}@example.com`
  const now = new Date()
  const [adminRole] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(and(eq(roles.code, 'admin'), eq(roles.status, true)))
    .limit(1)

  assert.ok(adminRole, 'Expected seeded admin role to exist')

  const [appUser] = await db
    .insert(users)
    .values({
      authUserId: null,
      email,
      nickname: 'Bound Mapping User',
      passwordHash: 'bound-placeholder',
      status: true,
      updatedAt: now,
      username: `bound_${suffix}`,
    })
    .returning({
      id: users.id,
    })

  assert.ok(appUser, 'Expected bound app user to be created')

  await db.insert(userRoles).values({
    roleId: adminRole.id,
    userId: appUser.id,
  })

  await createAuthIdentity(authUserId, email, 'Bound Mapping User')
  await db
    .update(users)
    .set({
      authUserId,
      updatedAt: now,
    })
    .where(eq(users.id, appUser.id))

  const profile = await loadUserPermissionProfileByAuthUserId(authUserId)

  assert.ok(profile)
  assert.equal(profile.userId, appUser.id)
  assert.deepEqual(profile.roleCodes, ['admin'])
})

test('loadUserPermissionProfileByAuthIdentity no longer backfills legacy email-linked users during normal auth resolution', async () => {
  const suffix = randomUUID().slice(0, 8)
  const authUserId = `legacy-auth-${suffix}`
  const email = `legacy-${suffix}@example.com`
  const [viewerRole] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(and(eq(roles.code, 'viewer'), eq(roles.status, true)))
    .limit(1)

  assert.ok(viewerRole, 'Expected seeded viewer role to exist')

  const [appUser] = await db
    .insert(users)
    .values({
      authUserId: null,
      email,
      nickname: 'Legacy Mapping User',
      passwordHash: 'legacy-placeholder',
      status: true,
      updatedAt: new Date(),
      username: `legacy_${suffix}`,
    })
    .returning({
      id: users.id,
    })

  assert.ok(appUser, 'Expected legacy app user to be created')

  await db.insert(userRoles).values({
    roleId: viewerRole.id,
    userId: appUser.id,
  })

  await createAuthIdentity(authUserId, email, 'Legacy Mapping User')

  const profile = await loadUserPermissionProfileByAuthIdentity(authUserId, email)
  const [reloadedUser] = await db
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(eq(users.id, appUser.id))
    .limit(1)

  assert.equal(profile, null)
  assert.equal(reloadedUser?.authUserId, null)
})

test('principal repair candidates expose email-matched legacy users and repair command binds them explicitly', async () => {
  const suffix = randomUUID().slice(0, 8)
  const authUserId = `repair-auth-${suffix}`
  const email = `repair-${suffix}@example.com`
  const [editorRole] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(and(eq(roles.code, 'editor'), eq(roles.status, true)))
    .limit(1)

  assert.ok(editorRole, 'Expected seeded editor role to exist')

  const [appUser] = await db
    .insert(users)
    .values({
      authUserId: null,
      email,
      nickname: 'Repair Candidate User',
      passwordHash: 'repair-placeholder',
      status: true,
      updatedAt: new Date(),
      username: `repair_${suffix}`,
    })
    .returning({
      id: users.id,
    })

  assert.ok(appUser, 'Expected repair candidate app user to be created')

  await db.insert(userRoles).values({
    roleId: editorRole.id,
    userId: appUser.id,
  })

  await createAuthIdentity(authUserId, email, 'Repair Candidate User')

  const candidates = await listPrincipalRepairCandidates(`repair_${suffix}`)
  const repairCandidate = candidates.find((candidate) => candidate.userId === appUser.id)

  assert.ok(repairCandidate)
  assert.equal(repairCandidate.authUserId, authUserId)
  assert.deepEqual(repairCandidate.roleCodes, ['editor'])

  const repairResults = await repairPrincipalBindings([appUser.id])
  const [reloadedUser] = await db
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(eq(users.id, appUser.id))
    .limit(1)

  assert.equal(repairResults.length, 1)
  assert.equal(repairResults[0]?.status, 'repaired')
  assert.equal(repairResults[0]?.authUserId, authUserId)
  assert.equal(reloadedUser?.authUserId, authUserId)
})
