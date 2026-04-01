import { createHash } from 'node:crypto'

import type { AppActions, AppSubjects, PermissionRule } from '@ai-native-os/shared'
import { inArray } from 'drizzle-orm'

import { type Database, db } from '../client'
import { menus, permissions, rolePermissions, roles, userRoles, users } from '../schema'

type PermissionKey = `${AppActions}:${AppSubjects}`
type MenuType = 'button' | 'directory' | 'menu'

export interface SeedRoleDefinition {
  code: string
  description: string
  id: string
  name: string
  permissions: PermissionRule[]
  sortOrder: number
}

export interface SeedUserDefinition {
  email: string
  id: string
  nickname: string
  roleCodes: string[]
  username: string
}

export interface SeedMenuDefinition {
  component: string | null
  icon: string | null
  id: string
  name: string
  parentId: string | null
  path: string | null
  permissionAction: AppActions | null
  permissionResource: AppSubjects | null
  sortOrder: number
  type: MenuType
}

export interface SeedSummary {
  menus: number
  permissions: number
  rolePermissions: number
  roles: number
  userRoles: number
  users: number
}

interface SeedPermissionDefinition extends PermissionRule {
  description: string
  id: string
}

function buildSeedUuid(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex')
  const variantByte = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0')

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variantByte}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

export function createPermissionKey(action: AppActions, subject: AppSubjects): PermissionKey {
  return `${action}:${subject}`
}

const systemDirectoryId = buildSeedUuid('menu:system')
const aiDirectoryId = buildSeedUuid('menu:ai')

export const defaultRoles: readonly SeedRoleDefinition[] = [
  {
    code: 'super_admin',
    description: '拥有所有权限',
    id: buildSeedUuid('role:super_admin'),
    name: '超级管理员',
    permissions: [{ action: 'manage', subject: 'all' }],
    sortOrder: 1,
  },
  {
    code: 'admin',
    description: '系统管理权限（不含超级管理员操作）',
    id: buildSeedUuid('role:admin'),
    name: '管理员',
    permissions: [
      { action: 'manage', subject: 'User' },
      { action: 'manage', subject: 'Role' },
      { action: 'manage', subject: 'Menu' },
      { action: 'manage', subject: 'Dict' },
      { action: 'read', subject: 'OperationLog' },
      { action: 'read', subject: 'AiAuditLog' },
      { action: 'manage', subject: 'AiKnowledge' },
    ],
    sortOrder: 2,
  },
  {
    code: 'editor',
    description: '内容编辑和数据管理',
    id: buildSeedUuid('role:editor'),
    name: '编辑员',
    permissions: [
      { action: 'read', subject: 'User' },
      { action: 'create', subject: 'User' },
      { action: 'update', subject: 'User' },
      { action: 'read', subject: 'Dict' },
      { action: 'export', subject: 'Report' },
    ],
    sortOrder: 3,
  },
  {
    code: 'viewer',
    description: '只读权限',
    id: buildSeedUuid('role:viewer'),
    name: '查看者',
    permissions: [
      { action: 'read', subject: 'User' },
      { action: 'read', subject: 'Role' },
      { action: 'read', subject: 'Menu' },
      { action: 'read', subject: 'Dict' },
      { action: 'read', subject: 'OperationLog' },
    ],
    sortOrder: 4,
  },
] as const

export const defaultUsers: readonly SeedUserDefinition[] = [
  {
    email: 'super_admin@ai-native-os.local',
    id: buildSeedUuid('user:super_admin'),
    nickname: '超级管理员',
    roleCodes: ['super_admin'],
    username: 'super_admin',
  },
  {
    email: 'admin@ai-native-os.local',
    id: buildSeedUuid('user:admin'),
    nickname: '管理员',
    roleCodes: ['admin'],
    username: 'admin',
  },
  {
    email: 'editor@ai-native-os.local',
    id: buildSeedUuid('user:editor'),
    nickname: '编辑员',
    roleCodes: ['editor'],
    username: 'editor',
  },
  {
    email: 'viewer@ai-native-os.local',
    id: buildSeedUuid('user:viewer'),
    nickname: '查看者',
    roleCodes: ['viewer'],
    username: 'viewer',
  },
] as const

export const defaultMenus: readonly SeedMenuDefinition[] = [
  {
    component: null,
    icon: 'settings',
    id: systemDirectoryId,
    name: '系统管理',
    parentId: null,
    path: '/system',
    permissionAction: null,
    permissionResource: null,
    sortOrder: 1,
    type: 'directory',
  },
  {
    component: 'system/users/page',
    icon: 'users',
    id: buildSeedUuid('menu:system-users'),
    name: '用户管理',
    parentId: systemDirectoryId,
    path: '/system/users',
    permissionAction: 'read',
    permissionResource: 'User',
    sortOrder: 1,
    type: 'menu',
  },
  {
    component: 'system/roles/page',
    icon: 'shield',
    id: buildSeedUuid('menu:system-roles'),
    name: '角色管理',
    parentId: systemDirectoryId,
    path: '/system/roles',
    permissionAction: 'read',
    permissionResource: 'Role',
    sortOrder: 2,
    type: 'menu',
  },
  {
    component: 'system/menus/page',
    icon: 'menu',
    id: buildSeedUuid('menu:system-menus'),
    name: '菜单管理',
    parentId: systemDirectoryId,
    path: '/system/menus',
    permissionAction: 'read',
    permissionResource: 'Menu',
    sortOrder: 3,
    type: 'menu',
  },
  {
    component: 'system/dicts/page',
    icon: 'book',
    id: buildSeedUuid('menu:system-dicts'),
    name: '字典管理',
    parentId: systemDirectoryId,
    path: '/system/dicts',
    permissionAction: 'read',
    permissionResource: 'Dict',
    sortOrder: 4,
    type: 'menu',
  },
  {
    component: 'system/logs/page',
    icon: 'history',
    id: buildSeedUuid('menu:system-logs'),
    name: '操作日志',
    parentId: systemDirectoryId,
    path: '/system/logs',
    permissionAction: 'read',
    permissionResource: 'OperationLog',
    sortOrder: 5,
    type: 'menu',
  },
  {
    component: null,
    icon: 'sparkles',
    id: aiDirectoryId,
    name: 'AI 管理',
    parentId: null,
    path: '/ai',
    permissionAction: null,
    permissionResource: null,
    sortOrder: 2,
    type: 'directory',
  },
  {
    component: 'ai/knowledge/page',
    icon: 'database',
    id: buildSeedUuid('menu:ai-knowledge'),
    name: '知识库管理',
    parentId: aiDirectoryId,
    path: '/ai/knowledge',
    permissionAction: 'manage',
    permissionResource: 'AiKnowledge',
    sortOrder: 1,
    type: 'menu',
  },
  {
    component: 'reports/page',
    icon: 'chart',
    id: buildSeedUuid('menu:reports'),
    name: '报表导出',
    parentId: null,
    path: '/reports',
    permissionAction: 'export',
    permissionResource: 'Report',
    sortOrder: 3,
    type: 'menu',
  },
] as const

const defaultPermissionMap = new Map<PermissionKey, SeedPermissionDefinition>()

for (const role of defaultRoles) {
  for (const permission of role.permissions) {
    const permissionKey = createPermissionKey(permission.action, permission.subject)

    if (defaultPermissionMap.has(permissionKey)) {
      continue
    }

    defaultPermissionMap.set(permissionKey, {
      ...permission,
      description: `${permission.subject} ${permission.action}`,
      id: buildSeedUuid(`permission:${permissionKey}`),
    })
  }
}

export const defaultPermissions: readonly SeedPermissionDefinition[] = [
  ...defaultPermissionMap.values(),
]

export const defaultRolePermissionKeysByCode: Readonly<Record<string, readonly PermissionKey[]>> =
  (() => {
    const rolePermissionKeys: Record<string, readonly PermissionKey[]> = {}

    for (const role of defaultRoles) {
      rolePermissionKeys[role.code] = role.permissions.map((permission) =>
        createPermissionKey(permission.action, permission.subject),
      )
    }

    return rolePermissionKeys
  })()

const roleIdByCode = new Map(defaultRoles.map((role) => [role.code, role.id]))
const permissionIdByKey = new Map(
  defaultPermissions.map((permission) => [
    createPermissionKey(permission.action, permission.subject),
    permission.id,
  ]),
)

function getRoleIdByCode(roleCode: string): string {
  const roleId = roleIdByCode.get(roleCode)

  if (!roleId) {
    throw new Error(`Unknown seed role code: ${roleCode}`)
  }

  return roleId
}

function getPermissionIdByKey(permissionKey: PermissionKey): string {
  const permissionId = permissionIdByKey.get(permissionKey)

  if (!permissionId) {
    throw new Error(`Unknown seed permission key: ${permissionKey}`)
  }

  return permissionId
}

export async function seedRbacDefaults(database: Database = db): Promise<SeedSummary> {
  const roleRows = defaultRoles.map((role) => ({
    code: role.code,
    description: role.description,
    id: role.id,
    name: role.name,
    sortOrder: role.sortOrder,
    status: true,
    updatedAt: new Date(),
  }))
  const permissionRows = defaultPermissions.map((permission) => ({
    action: permission.action,
    conditions: permission.conditions ?? null,
    description: permission.description,
    fields: permission.fields ?? null,
    id: permission.id,
    inverted: permission.inverted ?? false,
    resource: permission.subject,
  }))
  const userRows = defaultUsers.map((user) => ({
    email: user.email,
    id: user.id,
    nickname: user.nickname,
    passwordHash: 'rbac-seed-placeholder',
    status: true,
    updatedAt: new Date(),
    username: user.username,
  }))
  const menuRows = defaultMenus.map((menu) => ({
    component: menu.component,
    icon: menu.icon,
    id: menu.id,
    name: menu.name,
    parentId: menu.parentId,
    path: menu.path,
    permissionAction: menu.permissionAction,
    permissionResource: menu.permissionResource,
    sortOrder: menu.sortOrder,
    status: true,
    type: menu.type,
    visible: true,
  }))
  const rolePermissionRows = defaultRoles.flatMap((role) =>
    role.permissions.map((permission) => ({
      permissionId: getPermissionIdByKey(
        createPermissionKey(permission.action, permission.subject),
      ),
      roleId: role.id,
    })),
  )
  const userRoleRows = defaultUsers.flatMap((user) =>
    user.roleCodes.map((roleCode) => ({
      roleId: getRoleIdByCode(roleCode),
      userId: user.id,
    })),
  )

  await database.transaction(async (transaction) => {
    for (const permissionRow of permissionRows) {
      await transaction
        .insert(permissions)
        .values(permissionRow)
        .onConflictDoUpdate({
          set: {
            action: permissionRow.action,
            conditions: permissionRow.conditions,
            description: permissionRow.description,
            fields: permissionRow.fields,
            inverted: permissionRow.inverted,
            resource: permissionRow.resource,
          },
          target: permissions.id,
        })
    }

    for (const roleRow of roleRows) {
      await transaction
        .insert(roles)
        .values(roleRow)
        .onConflictDoUpdate({
          set: {
            code: roleRow.code,
            description: roleRow.description,
            name: roleRow.name,
            sortOrder: roleRow.sortOrder,
            status: roleRow.status,
            updatedAt: roleRow.updatedAt,
          },
          target: roles.id,
        })
    }

    for (const userRow of userRows) {
      await transaction
        .insert(users)
        .values(userRow)
        .onConflictDoUpdate({
          set: {
            email: userRow.email,
            nickname: userRow.nickname,
            passwordHash: userRow.passwordHash,
            status: userRow.status,
            updatedAt: userRow.updatedAt,
            username: userRow.username,
          },
          target: users.id,
        })
    }

    const seededMenuIds = menuRows.map((menu) => menu.id)
    if (seededMenuIds.length > 0) {
      await transaction.delete(menus).where(inArray(menus.id, seededMenuIds))
    }

    if (menuRows.length > 0) {
      await transaction.insert(menus).values(menuRows)
    }

    const seededRoleIds = roleRows.map((role) => role.id)
    const seededUserIds = userRows.map((user) => user.id)

    if (seededRoleIds.length > 0) {
      await transaction
        .delete(rolePermissions)
        .where(inArray(rolePermissions.roleId, seededRoleIds))
    }

    if (seededUserIds.length > 0) {
      await transaction.delete(userRoles).where(inArray(userRoles.userId, seededUserIds))
    }

    if (rolePermissionRows.length > 0) {
      await transaction.insert(rolePermissions).values(rolePermissionRows).onConflictDoNothing()
    }

    if (userRoleRows.length > 0) {
      await transaction.insert(userRoles).values(userRoleRows).onConflictDoNothing()
    }
  })

  return {
    menus: menuRows.length,
    permissions: permissionRows.length,
    rolePermissions: rolePermissionRows.length,
    roles: roleRows.length,
    userRoles: userRoleRows.length,
    users: userRows.length,
  }
}
