import {
  type AppActions,
  type AppSubjects,
  deserializeAbility,
  type PermissionRule,
  serializedAbilityResponseSchema,
} from '@ai-native-os/shared'

import {
  type AppRoute,
  navigationItems as configuredNavigationItems,
  type NavigationItem,
} from '@/config/nav-config'

export type AbilityPayload = ReturnType<typeof serializedAbilityResponseSchema.parse>
export type { AppRoute, NavigationItem }

export const navigationItems: readonly NavigationItem[] = configuredNavigationItems

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
 * 判断当前主体是否具备菜单目录写权限，供菜单管理页决定是否暴露 CRUD 表单。
 */
export function canManageMenus(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Menu') || ability.can('manage', 'all')
}

/**
 * 判断当前主体是否具备知识库写权限，供知识管理页决定是否暴露写路径。
 */
export function canManageKnowledge(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'AiKnowledge') || ability.can('manage', 'all')
}

/**
 * 根据当前 ability 过滤导航项，避免未授权页面入口暴露在侧边栏中。
 */
export function getVisibleNavigationItems(payload: AbilityPayload): NavigationItem[] {
  const ability = createAbilityFromPayload(payload)

  return navigationItems.filter((item) => ability.can(item.action, item.subject))
}
