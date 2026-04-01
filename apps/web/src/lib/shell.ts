import type { AppRoute } from './ability'
import type { AuthenticatedShellState } from './api'

const loginErrorMessages = {
  invalid_credentials:
    'Sign-in failed. Confirm the Better Auth account exists and the password is correct.',
  missing_credentials: 'Email and password are required.',
} as const

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
