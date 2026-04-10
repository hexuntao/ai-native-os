import {
  type AppActions,
  type AppSubjects,
  deserializeAbility,
  type PermissionRule,
  serializedAbilityResponseSchema,
} from '@ai-native-os/shared'

export type AbilityPayload = ReturnType<typeof serializedAbilityResponseSchema.parse>
export type AppRoute =
  | '/ai/knowledge'
  | '/ai/audit'
  | '/ai/evals'
  | '/monitor/online'
  | '/monitor/server'
  | '/reports'
  | '/system/menus'
  | '/system/users'
  | '/system/logs'
  | '/system/permissions'
  | '/system/roles'

export interface NavigationItem {
  action: AppActions
  description: string
  href: AppRoute
  label: string
  subject: AppSubjects
}

export const navigationItems: readonly NavigationItem[] = [
  {
    action: 'read',
    description: 'Inspect authenticated principals, status, and assigned roles.',
    href: '/system/users',
    label: 'Users Directory',
    subject: 'User',
  },
  {
    action: 'read',
    description: 'Inspect seeded roles and access surfaces.',
    href: '/system/roles',
    label: 'Roles Matrix',
    subject: 'Role',
  },
  {
    action: 'read',
    description: 'Review routed menu definitions and permission bindings.',
    href: '/system/menus',
    label: 'Navigation Registry',
    subject: 'Menu',
  },
  {
    action: 'read',
    description: 'Review operation history and audit visibility.',
    href: '/system/logs',
    label: 'Audit Trails',
    subject: 'OperationLog',
  },
  {
    action: 'read',
    description: 'Inspect live Better Auth sessions and mapped RBAC operators.',
    href: '/monitor/online',
    label: 'Live Sessions',
    subject: 'User',
  },
  {
    action: 'read',
    description: 'Inspect API and Mastra runtime health.',
    href: '/monitor/server',
    label: 'System Health',
    subject: 'OperationLog',
  },
  {
    action: 'manage',
    description: 'Manage AI knowledge assets and retrieval inputs.',
    href: '/ai/knowledge',
    label: 'Knowledge Vault',
    subject: 'AiKnowledge',
  },
  {
    action: 'read',
    description: 'Inspect AI audit traces and tool execution outcomes.',
    href: '/ai/audit',
    label: 'AI Audit Ledger',
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: 'Track evaluation readiness and dataset coverage.',
    href: '/ai/evals',
    label: 'Eval Registry',
    subject: 'AiAuditLog',
  },
  {
    action: 'manage',
    description: 'Admin-only permission topology editor.',
    href: '/system/permissions',
    label: 'Permission Center',
    subject: 'Permission',
  },
  {
    action: 'export',
    description: 'Export system reports when reporting scope is granted.',
    href: '/reports',
    label: 'Reports Export',
    subject: 'Report',
  },
] as const

/**
 * 解析来自 API 的序列化权限载荷，统一恢复为前端可消费的稳定结构。
 */
export function parseSerializedAbilityPayload(payload: unknown): AbilityPayload {
  return serializedAbilityResponseSchema.parse(payload)
}

/**
 * 规范化规则数组，便于交给 CASL 反序列化逻辑安全恢复 ability 实例。
 */
function normalizeRulesForAbility(payload: AbilityPayload): PermissionRule[] {
  return payload.rules.map((rule) => {
    const normalizedRule: PermissionRule = {
      action: rule.action as AppActions,
      subject: rule.subject as AppSubjects,
    }

    if (rule.conditions) {
      normalizedRule.conditions = rule.conditions as never
    }

    if (rule.fields) {
      normalizedRule.fields = rule.fields
    }

    if (rule.inverted) {
      normalizedRule.inverted = true
    }

    return normalizedRule
  })
}

/**
 * 把序列化后的权限载荷恢复为前端可复用的 CASL ability 实例。
 */
export function createAbilityFromPayload(
  payload: AbilityPayload,
): ReturnType<typeof deserializeAbility> {
  return deserializeAbility(normalizeRulesForAbility(payload))
}

/**
 * 判断当前主体是否具备用户目录写权限，供服务端页面决定是否暴露 CRUD 表单。
 */
export function canManageUserDirectory(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'User') || ability.can('manage', 'all')
}

/**
 * 判断当前主体是否具备角色目录写权限，供角色管理页决定是否暴露 CRUD 表单。
 */
export function canManageRoles(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Role') || ability.can('manage', 'all')
}

/**
 * 判断当前主体是否具备权限中心写权限，供权限管理页决定是否暴露 CRUD 表单。
 */
export function canManagePermissions(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Permission') || ability.can('manage', 'all')
}

/**
 * 根据当前 ability 过滤导航项，避免未授权页面入口暴露在侧边栏中。
 */
export function getVisibleNavigationItems(payload: AbilityPayload): NavigationItem[] {
  const ability = createAbilityFromPayload(payload)

  return navigationItems.filter((item) => ability.can(item.action, item.subject))
}
