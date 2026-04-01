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
  | '/reports'
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
    description: 'Inspect seeded roles and access surfaces.',
    href: '/system/roles',
    label: 'Roles Matrix',
    subject: 'Role',
  },
  {
    action: 'read',
    description: 'Review operation history and audit visibility.',
    href: '/system/logs',
    label: 'Audit Trails',
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

export function parseSerializedAbilityPayload(payload: unknown): AbilityPayload {
  return serializedAbilityResponseSchema.parse(payload)
}

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

export function getVisibleNavigationItems(payload: AbilityPayload): NavigationItem[] {
  const ability = deserializeAbility(normalizeRulesForAbility(payload))

  return navigationItems.filter((item) => ability.can(item.action, item.subject))
}
