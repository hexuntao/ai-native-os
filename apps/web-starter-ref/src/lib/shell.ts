import {
  type AppRoute,
  type NavigationGroupKey,
  type NavigationItem,
  navigationGroupOrder,
  navigationGroups,
  resolveNavigationItemForPath,
} from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'

const loginErrorMessages = {
  invalid_credentials: '登录失败。请确认本地种子管理员账号或现有 Better Auth 密码是否正确。',
  missing_credentials: '请输入邮箱和密码。',
} as const

export interface NavigationGroup {
  description: string
  items: NavigationItem[]
  key: NavigationGroupKey
  label: string
}

export function resolveActiveNavigationItem(
  pathname: string,
  visibleNavigation: readonly NavigationItem[],
): NavigationItem | null {
  return visibleNavigation.find((item) => isNavigationItemActive(item.href, pathname)) ?? null
}

export function groupNavigationItems(
  visibleNavigation: readonly NavigationItem[],
): NavigationGroup[] {
  const groupedItems = visibleNavigation.reduce<Record<NavigationGroupKey, NavigationItem[]>>(
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

export function resolveDashboardLandingHref(state: AuthenticatedShellState): AppRoute {
  return state.visibleNavigation[0]?.href ?? '/dashboard/overview'
}

export function isNavigationItemActive(href: AppRoute, pathname: string): boolean {
  const navigationItem = resolveNavigationItemForPath(href)
  const candidateHrefs = navigationItem
    ? [navigationItem.href, ...(navigationItem.aliases ?? [])]
    : [href]

  return candidateHrefs.some(
    (candidateHref) => pathname === candidateHref || pathname.startsWith(`${candidateHref}/`),
  )
}

export function resolveLoginErrorMessage(errorCode: string | undefined): string | undefined {
  if (!errorCode) {
    return undefined
  }

  return loginErrorMessages[errorCode as keyof typeof loginErrorMessages]
}
