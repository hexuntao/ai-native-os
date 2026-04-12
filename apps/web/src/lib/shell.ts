import type { AppRoute, NavigationItem } from './ability'
import type { AuthenticatedShellState } from './api'

const loginErrorMessages = {
  invalid_credentials:
    'Sign-in failed. Confirm the seeded local admin or existing Better Auth password is correct.',
  missing_credentials: 'Email and password are required.',
} as const

export interface NavigationGroup {
  items: NavigationItem[]
  key: 'ai' | 'monitor' | 'reports' | 'system'
  label: string
}

const navigationGroupOrder = ['system', 'monitor', 'ai', 'reports'] as const

const navigationGroupLabels = {
  ai: 'AI Governance',
  monitor: 'Observability',
  reports: 'Exports',
  system: 'System Control',
} as const

/**
 * 按路由前缀推断当前页面所属模块，供 shell 标题与导航分组复用。
 */
export function resolveShellModuleLabel(pathname: string): string {
  if (pathname.startsWith('/system')) {
    return navigationGroupLabels.system
  }

  if (pathname.startsWith('/monitor')) {
    return navigationGroupLabels.monitor
  }

  if (pathname.startsWith('/ai')) {
    return navigationGroupLabels.ai
  }

  if (pathname.startsWith('/reports')) {
    return navigationGroupLabels.reports
  }

  return 'Operator Workspace'
}

/**
 * 返回当前激活的导航项，避免 shell 标题与页面路由脱节。
 */
export function resolveActiveNavigationItem(
  pathname: string,
  visibleNavigation: readonly NavigationItem[],
): NavigationItem | null {
  return visibleNavigation.find((item) => isNavigationItemActive(item.href, pathname)) ?? null
}

/**
 * 把导航项按后台模块分组，形成稳定的控制台信息架构。
 */
export function groupNavigationItems(
  visibleNavigation: readonly NavigationItem[],
): NavigationGroup[] {
  const groupedItems = visibleNavigation.reduce<Record<NavigationGroup['key'], NavigationItem[]>>(
    (result, item) => {
      const groupKey = item.href.startsWith('/system')
        ? 'system'
        : item.href.startsWith('/monitor')
          ? 'monitor'
          : item.href.startsWith('/ai')
            ? 'ai'
            : 'reports'

      result[groupKey].push(item)

      return result
    },
    {
      ai: [],
      monitor: [],
      reports: [],
      system: [],
    },
  )

  return navigationGroupOrder
    .map((groupKey) => ({
      items: groupedItems[groupKey],
      key: groupKey,
      label: navigationGroupLabels[groupKey],
    }))
    .filter((group) => group.items.length > 0)
}

/**
 * 为已登录主体解析默认落点，保证根路由不会停留在无意义的空白 dashboard。
 */
export function resolveDashboardLandingHref(state: AuthenticatedShellState): AppRoute {
  return state.visibleNavigation[0]?.href ?? '/system/roles'
}

/**
 * 判断导航项是否应视为当前激活页面。
 */
export function isNavigationItemActive(href: AppRoute, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * 统一把登录错误码映射成人类可读消息，避免页面层散落硬编码字符串。
 */
export function resolveLoginErrorMessage(errorCode: string | undefined): string | undefined {
  if (!errorCode) {
    return undefined
  }

  return loginErrorMessages[errorCode as keyof typeof loginErrorMessages]
}
