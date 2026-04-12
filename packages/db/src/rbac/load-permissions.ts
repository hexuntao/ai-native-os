import {
  type AppActions,
  type AppSubjects,
  appActions,
  appSubjects,
  type PermissionRule,
} from '@ai-native-os/shared'
import { and, eq, isNull } from 'drizzle-orm'

import { type Database, db } from '../client'
import { permissions, rolePermissions, roles, userRoles, users } from '../schema'

interface ActiveUserRecord {
  authUserId: string | null
  id: string
}

interface StoredPermissionRecord {
  action: string
  conditions: Record<string, unknown> | null
  fields: string[] | null
  inverted: boolean
  resource: string
}

type PermissionConditions = Exclude<PermissionRule['conditions'], undefined>

export interface UserPermissionProfile {
  roleCodes: string[]
  rules: PermissionRule[]
  userId: string
}

export function isAppActionValue(action: string): action is AppActions {
  return appActions.includes(action as AppActions)
}

export function isAppSubjectValue(subject: string): subject is AppSubjects {
  return appSubjects.includes(subject as AppSubjects)
}

export function mapPermissionRecordToRule(record: StoredPermissionRecord): PermissionRule {
  if (!isAppActionValue(record.action)) {
    throw new Error(`Invalid permission action found in database: ${record.action}`)
  }

  if (!isAppSubjectValue(record.resource)) {
    throw new Error(`Invalid permission resource found in database: ${record.resource}`)
  }

  const rule: PermissionRule = {
    action: record.action,
    subject: record.resource,
  }

  if (record.conditions) {
    rule.conditions = record.conditions as PermissionConditions
  }

  if (record.fields && record.fields.length > 0) {
    rule.fields = record.fields
  }

  if (record.inverted) {
    rule.inverted = true
  }

  return rule
}

export function createPermissionRuleSignature(rule: PermissionRule): string {
  return JSON.stringify({
    action: rule.action,
    conditions: rule.conditions ?? null,
    fields: rule.fields ?? null,
    inverted: rule.inverted ?? false,
    subject: rule.subject,
  })
}

export function dedupePermissionRules(rules: PermissionRule[]): PermissionRule[] {
  const signatures = new Set<string>()
  const uniqueRules: PermissionRule[] = []

  for (const rule of rules) {
    const signature = createPermissionRuleSignature(rule)

    if (signatures.has(signature)) {
      continue
    }

    signatures.add(signature)
    uniqueRules.push(rule)
  }

  return uniqueRules
}

async function loadActiveUserById(
  database: Database,
  userId: string,
): Promise<ActiveUserRecord | null> {
  const [user] = await database
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.status, true)))
    .limit(1)

  return user ?? null
}

async function loadActiveUserByEmail(
  database: Database,
  email: string,
): Promise<ActiveUserRecord | null> {
  const [user] = await database
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, true)))
    .limit(1)

  return user ?? null
}

async function loadUserByAuthUserId(
  database: Database,
  authUserId: string,
): Promise<ActiveUserRecord | null> {
  const [user] = await database
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1)

  return user ?? null
}

/**
 * 对历史 email 软关联记录做一次性主键回填，避免后续继续以邮箱作为主连接键。
 */
async function bindActiveUserToAuthUserIdByEmail(
  database: Database,
  authUserId: string,
  email: string,
): Promise<ActiveUserRecord | null> {
  const existingBoundUser = await loadUserByAuthUserId(database, authUserId)

  if (existingBoundUser) {
    return existingBoundUser
  }

  const userByEmail = await loadActiveUserByEmail(database, email)

  if (!userByEmail) {
    return null
  }

  if (userByEmail.authUserId && userByEmail.authUserId !== authUserId) {
    return null
  }

  await database
    .update(users)
    .set({
      authUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userByEmail.id), isNull(users.authUserId)))

  return {
    authUserId,
    id: userByEmail.id,
  }
}

async function loadRoleCodesForUser(database: Database, userId: string): Promise<string[]> {
  const roleRows = await database
    .select({
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.status, true)))

  return [...new Set(roleRows.map((roleRow) => roleRow.roleCode))].sort()
}

async function loadStoredPermissionRecordsForUser(
  database: Database,
  userId: string,
): Promise<StoredPermissionRecord[]> {
  return database
    .select({
      action: permissions.action,
      conditions: permissions.conditions,
      fields: permissions.fields,
      inverted: permissions.inverted,
      resource: permissions.resource,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.status, true)))
}

async function loadPermissionProfileForUser(
  database: Database,
  user: ActiveUserRecord | null,
): Promise<UserPermissionProfile | null> {
  if (!user) {
    return null
  }

  const [roleCodes, permissionRecords] = await Promise.all([
    loadRoleCodesForUser(database, user.id),
    loadStoredPermissionRecordsForUser(database, user.id),
  ])

  return {
    roleCodes,
    rules: dedupePermissionRules(permissionRecords.map(mapPermissionRecordToRule)),
    userId: user.id,
  }
}

export async function loadUserPermissionProfileByUserId(
  userId: string,
  database: Database = db,
): Promise<UserPermissionProfile | null> {
  return loadPermissionProfileForUser(database, await loadActiveUserById(database, userId))
}

export async function loadUserPermissionProfileByAuthUserId(
  authUserId: string,
  database: Database = db,
): Promise<UserPermissionProfile | null> {
  return loadPermissionProfileForUser(database, await loadUserByAuthUserId(database, authUserId))
}

export async function loadUserPermissionProfileByEmail(
  email: string,
  database: Database = db,
): Promise<UserPermissionProfile | null> {
  return loadPermissionProfileForUser(database, await loadActiveUserByEmail(database, email))
}

/**
 * 优先按稳定 auth user 主键加载 RBAC 权限，并在旧数据仍未绑定时做一次受限回填。
 */
export async function loadUserPermissionProfileByAuthIdentity(
  authUserId: string,
  email: string | null,
  database: Database = db,
): Promise<UserPermissionProfile | null> {
  const userByAuthUserId = await loadUserByAuthUserId(database, authUserId)

  if (userByAuthUserId) {
    return loadPermissionProfileForUser(database, userByAuthUserId)
  }

  if (!email) {
    return null
  }

  const reboundUser = await bindActiveUserToAuthUserIdByEmail(database, authUserId, email)

  return loadPermissionProfileForUser(database, reboundUser)
}

export async function loadPermissionRulesForUserId(
  userId: string,
  database: Database = db,
): Promise<PermissionRule[]> {
  const profile = await loadUserPermissionProfileByUserId(userId, database)

  return profile?.rules ?? []
}

export async function loadPermissionRulesForUserEmail(
  email: string,
  database: Database = db,
): Promise<PermissionRule[]> {
  const profile = await loadUserPermissionProfileByEmail(email, database)

  return profile?.rules ?? []
}
