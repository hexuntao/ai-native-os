import {
  deserializeAbility,
  type PermissionRule,
  serializedAbilityResponseSchema,
} from '@ai-native-os/shared'
import { type NavigationItem, navigationItems } from '@/config/nav-config'

export type AbilityPayload = ReturnType<typeof serializedAbilityResponseSchema.parse>

export function parseSerializedAbilityPayload(payload: unknown): AbilityPayload {
  return serializedAbilityResponseSchema.parse(payload)
}

function normalizeRulesForAbility(payload: AbilityPayload): PermissionRule[] {
  return payload.rules.map((rule) => {
    const normalizedRule: PermissionRule = {
      action: rule.action,
      subject: rule.subject,
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

export function createAbilityFromPayload(
  payload: AbilityPayload,
): ReturnType<typeof deserializeAbility> {
  return deserializeAbility(normalizeRulesForAbility(payload))
}

export function canManageUserDirectory(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'User') || ability.can('manage', 'all')
}

export function canManageRoles(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Role') || ability.can('manage', 'all')
}

export function canManagePermissions(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Permission') || ability.can('manage', 'all')
}

export function canReadPermissions(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return (
    ability.can('read', 'Permission') ||
    ability.can('manage', 'Permission') ||
    ability.can('manage', 'all')
  )
}

export function canManageMenus(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'Menu') || ability.can('manage', 'all')
}

export function canManageKnowledge(payload: AbilityPayload): boolean {
  const ability = createAbilityFromPayload(payload)

  return ability.can('manage', 'AiKnowledge') || ability.can('manage', 'all')
}

export function getVisibleNavigationItems(payload: AbilityPayload): NavigationItem[] {
  const ability = createAbilityFromPayload(payload)
  return navigationItems.filter((item) => ability.can(item.action, item.subject))
}
