import {
  type AppRoute,
  type NavigationGroupKey,
  type NavigationItem,
  navigationGroupOrder,
  navigationGroups,
  resolveNavigationGroupLabel,
  resolveNavigationItemForPath,
} from '@/config/nav-config'
import type { AuthenticatedShellState } from './api'

const loginErrorMessages = {
  invalid_credentials:
    'Sign-in failed. Confirm the seeded local admin or existing Better Auth password is correct.',
  missing_credentials: 'Email and password are required.',
} as const

export interface NavigationGroup {
  description: string
  items: NavigationItem[]
  key: NavigationGroupKey
  label: string
}

/**
 * 按路由前缀推断当前页面所属模块，供 shell 标题与导航分组复用。
 */
export function resolveShellModuleLabel(pathname: string): string {
  const navigationItem = resolveNavigationItemForPath(pathname)

  return navigationItem ? resolveNavigationGroupLabel(navigationItem.group) : 'Operator Workspace'
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
      result[item.group].push(item)

      return result
    },
    {
      admin: [],
      build: [],
      govern: [],
      home: [],
      improve: [],
      knowledge: [],
      observe: [],
      workspace: [],
    },
  )

  return navigationGroupOrder
    .map((groupKey) => ({
      description: navigationGroups[groupKey].description,
      items: groupedItems[groupKey],
      key: groupKey,
      label: navigationGroups[groupKey].label,
    }))
    .filter((group) => group.items.length > 0)
}

/**
 * 为已登录主体解析默认落点，保证根路由不会停留在无意义的空白 dashboard。
 */
export function resolveDashboardLandingHref(state: AuthenticatedShellState): AppRoute {
  return state.visibleNavigation[0]?.href ?? '/home'
}

/**
 * 判断导航项是否应视为当前激活页面。
 */
export function isNavigationItemActive(href: AppRoute, pathname: string): boolean {
  const navigationItem = resolveNavigationItemForPath(href)
  const candidateHrefs = navigationItem
    ? [navigationItem.href, ...(navigationItem.legacyHrefs ?? [])]
    : [href]

  return candidateHrefs.some((candidateHref) => {
    return pathname === candidateHref || pathname.startsWith(`${candidateHref}/`)
  })
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
