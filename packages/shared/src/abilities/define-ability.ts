import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
  type MongoQuery,
} from '@casl/ability'

import type { AppActions, AppSubjects } from './subjects'

type AppConditions = MongoQuery<never>
export type AppAbility = MongoAbility<[AppActions, AppSubjects], AppConditions>

export interface PermissionRule {
  action: AppActions
  subject: AppSubjects
  conditions?: AppConditions
  fields?: string[]
  inverted?: boolean
}

function applyCanRule(can: AbilityBuilder<AppAbility>['can'], rule: PermissionRule): void {
  if (rule.fields && rule.conditions) {
    can(rule.action, rule.subject, rule.fields, rule.conditions)
    return
  }

  if (rule.fields) {
    can(rule.action, rule.subject, rule.fields)
    return
  }

  if (rule.conditions) {
    can(rule.action, rule.subject, rule.conditions)
    return
  }

  can(rule.action, rule.subject)
}

function applyCannotRule(cannot: AbilityBuilder<AppAbility>['cannot'], rule: PermissionRule): void {
  if (rule.fields && rule.conditions) {
    cannot(rule.action, rule.subject, rule.fields, rule.conditions)
    return
  }

  if (rule.fields) {
    cannot(rule.action, rule.subject, rule.fields)
    return
  }

  if (rule.conditions) {
    cannot(rule.action, rule.subject, rule.conditions)
    return
  }

  cannot(rule.action, rule.subject)
}

export function defineAbilityFor(rules: PermissionRule[]): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  for (const rule of rules) {
    if (rule.inverted) {
      applyCannotRule(cannot, rule)
      continue
    }

    applyCanRule(can, rule)
  }

  return build()
}

export function serializeAbility(ability: AppAbility): AppAbility['rules'] {
  return ability.rules
}

export function deserializeAbility(rules: PermissionRule[]): AppAbility {
  return defineAbilityFor(rules)
}
