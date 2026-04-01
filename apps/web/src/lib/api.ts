import {
  type CopilotBridgeSummary,
  copilotBridgeSummarySchema,
  currentPermissionsResponseSchema,
} from '@ai-native-os/shared'

import {
  type AbilityPayload,
  getVisibleNavigationItems,
  parseSerializedAbilityPayload,
} from './ability'
import type { WebEnvironment } from './env'

export interface SessionUser {
  email: string
  name: string
}

export interface SessionPayload {
  user: SessionUser
}

export interface AuthenticatedShellState {
  hiddenNavigationCount: number
  kind: 'authenticated'
  permissionRuleCount: number
  roleCodes: string[]
  session: SessionPayload
  visibleNavigation: ReturnType<typeof getVisibleNavigationItems>
}

export interface UnauthenticatedShellState {
  errorMessage?: string
  kind: 'unauthenticated'
}

export type ShellState = AuthenticatedShellState | UnauthenticatedShellState

function createJsonRequestInit(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): RequestInit {
  const headers = new Headers({
    accept: 'application/json',
    origin: environment.appUrl,
  })

  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  return {
    cache: 'no-store',
    headers,
  }
}

export async function fetchSession(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<SessionPayload | null> {
  try {
    const response = await fetch(
      `${environment.apiUrl}/api/auth/get-session`,
      createJsonRequestInit(cookieHeader, environment),
    )

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as SessionPayload | null

    return payload
  } catch {
    return null
  }
}

export async function fetchSerializedAbilityPayload(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<AbilityPayload | null> {
  try {
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions/ability`,
      createJsonRequestInit(cookieHeader, environment),
    )

    if (!response.ok) {
      return null
    }

    const envelope = (await response.json()) as {
      json: unknown
    }

    return parseSerializedAbilityPayload(envelope.json)
  } catch {
    return null
  }
}

export async function fetchCurrentPermissions(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<{
  permissionRuleCount: number
  roleCodes: string[]
} | null> {
  try {
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions/current`,
      createJsonRequestInit(cookieHeader, environment),
    )

    if (!response.ok) {
      return null
    }

    const envelope = (await response.json()) as {
      json: unknown
    }
    const payload = currentPermissionsResponseSchema.parse(envelope.json)

    return {
      permissionRuleCount: payload.permissionRules.length,
      roleCodes: payload.roleCodes,
    }
  } catch {
    return null
  }
}

/**
 * 读取当前主体可见的 Copilot/AG-UI 运行时发现信息。
 *
 * 安全约束：
 * - 仍然复用同一套 cookie 与 origin 头，避免 web 层制造第二套认证语义
 * - 失败时返回 `null`，由页面层决定是否降级显示助手面板
 */
export async function fetchCopilotBridgeSummary(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<CopilotBridgeSummary | null> {
  try {
    const response = await fetch(
      `${environment.apiUrl}/api/ag-ui/runtime`,
      createJsonRequestInit(cookieHeader, environment),
    )

    if (!response.ok) {
      return null
    }

    return copilotBridgeSummarySchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function loadShellState(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  errorMessage?: string,
): Promise<ShellState> {
  const session = await fetchSession(cookieHeader, environment)

  if (!session) {
    return errorMessage
      ? {
          errorMessage,
          kind: 'unauthenticated',
        }
      : {
          kind: 'unauthenticated',
        }
  }

  const [abilityPayload, permissionsPayload] = await Promise.all([
    fetchSerializedAbilityPayload(cookieHeader, environment),
    fetchCurrentPermissions(cookieHeader, environment),
  ])

  if (!abilityPayload || !permissionsPayload) {
    return {
      errorMessage: 'Permission context is unavailable. Reauthenticate to refresh the shell.',
      kind: 'unauthenticated',
    }
  }

  const visibleNavigation = getVisibleNavigationItems(abilityPayload)

  return {
    hiddenNavigationCount: Math.max(0, 5 - visibleNavigation.length),
    kind: 'authenticated',
    permissionRuleCount: permissionsPayload.permissionRuleCount,
    roleCodes: permissionsPayload.roleCodes,
    session,
    visibleNavigation,
  }
}
