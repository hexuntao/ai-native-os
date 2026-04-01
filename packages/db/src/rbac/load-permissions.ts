import {
  type AppActions,
  type AppSubjects,
  appActions,
  appSubjects,
  type PermissionRule,
} from '@ai-native-os/shared'
import { and, eq } from 'drizzle-orm'

import { type Database, db } from '../client'
import { permissions, rolePermissions, roles, userRoles, users } from '../schema'

interface ActiveUserRecord {
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
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, true)))
    .limit(1)

  return user ?? null
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

export async function loadUserPermissionProfileByEmail(
  email: string,
  database: Database = db,
): Promise<UserPermissionProfile | null> {
  return loadPermissionProfileForUser(database, await loadActiveUserByEmail(database, email))
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
