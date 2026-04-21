import {
  deserializeAbility,
  type PermissionRule,
  serializedAbilityResponseSchema
} from '@ai-native-os/shared';
import { navigationItems, type NavigationItem } from '@/config/nav-config';

export type AbilityPayload = ReturnType<typeof serializedAbilityResponseSchema.parse>;

export function parseSerializedAbilityPayload(payload: unknown): AbilityPayload {
  return serializedAbilityResponseSchema.parse(payload);
}

function normalizeRulesForAbility(payload: AbilityPayload): PermissionRule[] {
  return payload.rules.map((rule) => {
    const normalizedRule: PermissionRule = {
      action: rule.action,
      subject: rule.subject
    };

    if (rule.conditions) {
      normalizedRule.conditions = rule.conditions as never;
    }

    if (rule.fields) {
      normalizedRule.fields = rule.fields;
    }

    if (rule.inverted) {
      normalizedRule.inverted = true;
    }

    return normalizedRule;
  });
}

export function createAbilityFromPayload(
  payload: AbilityPayload
): ReturnType<typeof deserializeAbility> {
  return deserializeAbility(normalizeRulesForAbility(payload));
}

export function getVisibleNavigationItems(payload: AbilityPayload): NavigationItem[] {
  const ability = createAbilityFromPayload(payload);
  return navigationItems.filter((item) => ability.can(item.action, item.subject));
}
